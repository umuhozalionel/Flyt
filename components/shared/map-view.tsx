"use client"

import "maplibre-gl/dist/maplibre-gl.css"
import type { Map as MapLibreMap, Marker, StyleSpecification } from "maplibre-gl"
import { CarFront, MapPin } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { mapStyleDarkUrl, mapStyleUrl } from "@/lib/config"
import { useT } from "@/lib/i18n"
import { bearing, between, boundsOf, isKigaliNight, KIGALI, KIGALI_ZOOM, placeLngLat, routeLine, type LngLat } from "@/lib/map"
import { placeName, places } from "@/lib/places"
import type { PlaceId } from "@/lib/types"
import { useNow } from "@/lib/use-now"

// The one map component. Screens never touch MapLibre directly, so the provider can be swapped here.
// Style URLs come from config (OpenFreeMap by default). If the style or its tiles fail to load, the map switches to
// a plain built-in style that draws only our places, so booking still works. Without WebGL it shows a static picture.

export interface MapCar {
  key: string
  position: LngLat
  state?: "free" | "on_trip"
  label?: string
}

export interface MapViewProps {
  pickup?: PlaceId
  dropoff?: PlaceId
  /** The car on this trip: true puts it near the pickup, or pass its position. */
  car?: boolean | LngLat
  /** Other cars to draw (free cars near the rider, or the fleet in Ops). */
  cars?: MapCar[]
  /** The person's own position, when they shared it. */
  me?: LngLat | null
  /** A pulse at the pickup while a driver is being found. */
  searching?: boolean
  /** Fill the parent (for map-first screens) instead of a rounded card. */
  full?: boolean
  /** Space kept clear of sheets and buttons when fitting the map, in pixels. */
  padding?: { top?: number; bottom?: number; left?: number; right?: number }
  /** Where to centre the map when there is no pickup or own position (for example the driver's zone). */
  center?: LngLat
  /** Change it to fit the map again (for example a "centre on me" button). */
  focus?: number
  className?: string
  label?: string
}

// loading: MapLibre is not ready yet; drawing: the map exists (markers can be drawn) while the style loads.
type Mode = "loading" | "drawing" | "tiles" | "fallback" | "static"

const OSM_ATTRIBUTION = '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a>'
const MOVE_MS = 2900
const TILE_TIMEOUT_MS = 8000

/** The built-in style used when tiles cannot load: a plain background; our places are drawn on top. */
function fallbackStyle(dark: boolean): StyleSpecification {
  return { version: 8, sources: {}, layers: [{ id: "flyt-background", type: "background", paint: { "background-color": dark ? "#1f2622" : "#eef3eb" } }] }
}

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches

/** Dark map at night in Kigali, or when the app itself is dark. */
function useMapDark() {
  const now = useNow(60_000)
  const [themeDark, setThemeDark] = useState(false)
  useEffect(() => {
    const root = document.documentElement
    const read = () => setThemeDark(root.classList.contains("dark"))
    read()
    const observer = new MutationObserver(read)
    observer.observe(root, { attributes: true, attributeFilter: ["class"] })
    return () => observer.disconnect()
  }, [])
  return themeDark || isKigaliNight(now)
}

function element(className: string, html = "") {
  const node = document.createElement("div")
  node.className = className
  node.innerHTML = html
  return node
}

const carSvg = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="2.5" width="12" height="19" rx="4.5" fill="currentColor"/><rect x="8" y="6" width="8" height="4" rx="1.4" fill="#fff" opacity=".85"/><rect x="8" y="15" width="8" height="3" rx="1.2" fill="#fff" opacity=".6"/></svg>'

/** Our layers: the route line, and in the built-in style the places too. Added again after each style change. */
function addLayers(map: MapLibreMap, lib: typeof import("maplibre-gl"), trip: { pickup?: PlaceId; dropoff?: PlaceId }, fallback: boolean, dark: boolean): Marker[] {
  const { pickup: from, dropoff: to } = trip
  const route = from && to && from !== to ? routeLine(from, to) : { type: "FeatureCollection" as const, features: [] }
  if (!map.getSource("flyt-route")) map.addSource("flyt-route", { type: "geojson", data: route })
  if (!map.getLayer("flyt-route-casing")) map.addLayer({ id: "flyt-route-casing", type: "line", source: "flyt-route", layout: { "line-cap": "round" }, paint: { "line-color": dark ? "#0d1411" : "#ffffff", "line-width": 9, "line-opacity": 0.9 } })
  if (!map.getLayer("flyt-route")) map.addLayer({ id: "flyt-route", type: "line", source: "flyt-route", layout: { "line-cap": "round" }, paint: { "line-color": dark ? "#4fd39b" : "#13925f", "line-width": 5 } })
  if (!fallback) return []
  return places.map((place) => {
    const node = element("flyt-place", `<span></span>${place.name}`)
    node.setAttribute("aria-hidden", "true")
    return new lib.Marker({ element: node, anchor: "top" }).setLngLat(placeLngLat(place.id)).addTo(map)
  })
}

export function MapView({ pickup, dropoff, car, cars, me, searching = false, full = false, padding, focus = 0, center, className = "", label }: MapViewProps) {
  const t = useT()
  const dark = useMapDark()
  const holder = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const libRef = useRef<typeof import("maplibre-gl") | null>(null)
  const [mode, setMode] = useState<Mode>("loading")
  const fallbackRef = useRef(false)
  const darkRef = useRef(dark)
  const props = useRef({ pickup, dropoff })
  const pins = useRef<{ pickup?: Marker; dropoff?: Marker; me?: Marker; pulse?: Marker; places: Marker[] }>({ places: [] })
  const carMarkers = useRef(new Map<string, { marker: Marker; from: LngLat; to: LngLat; start: number }>())
  const frame = useRef(0)

  // The trip's car: near the pickup when no position is given (drivers share their zone, not GPS).
  const tripCar: MapCar | undefined = useMemo(() => {
    if (!car) return undefined
    const position = car === true ? between(placeLngLat(pickup), placeLngLat(dropoff ?? pickup), -0.12) : car
    return { key: "trip-car", position, state: "on_trip" }
  }, [car, pickup, dropoff])
  const allCars = useMemo(() => [...(cars ?? []), ...(tripCar ? [tripCar] : [])], [cars, tripCar])

  useEffect(() => {
    props.current = { pickup, dropoff }
  }, [pickup, dropoff])

  // Create the map once.
  useEffect(() => {
    let cancelled = false
    let timer = 0
    const markers = carMarkers.current
    void import("maplibre-gl")
      .then((lib) => {
        if (cancelled || !holder.current) return
        libRef.current = lib
        // The worker file is copied into public/vendor by scripts/copy-map-worker.mjs.
        if (!lib.getWorkerUrl().startsWith(window.location.origin + "/vendor/")) lib.setWorkerUrl(`${window.location.origin}/vendor/maplibre-gl-worker.mjs`)
        let map: MapLibreMap
        try {
          map = new lib.Map({
            container: holder.current,
            style: darkRef.current ? mapStyleDarkUrl : mapStyleUrl,
            center: KIGALI,
            zoom: KIGALI_ZOOM,
            attributionControl: { compact: true, customAttribution: OSM_ATTRIBUTION },
            fadeDuration: reducedMotion() ? 0 : 250,
            dragRotate: false,
            pitchWithRotate: false,
          })
        } catch {
          setMode("static")
          return
        }
        mapRef.current = map
        setMode((current) => (current === "loading" ? "drawing" : current))
        map.touchZoomRotate.disableRotation()
        let tilesOk = false
        let errors = 0
        const switchToFallback = () => {
          if (fallbackRef.current || cancelled) return
          fallbackRef.current = true
          map.setStyle(fallbackStyle(darkRef.current))
        }
        map.on("data", (event) => {
          if ("tile" in event && event.tile) tilesOk = true
        })
        map.on("error", (event) => {
          const message = String(event.error?.message ?? "")
          if (/webgl/i.test(message)) return setMode("static")
          if (!tilesOk && ++errors >= 2) switchToFallback()
        })
        timer = window.setTimeout(() => !tilesOk && switchToFallback(), TILE_TIMEOUT_MS)
        map.on("style.load", () => {
          for (const marker of pins.current.places) marker.remove()
          pins.current.places = addLayers(map, lib, props.current, fallbackRef.current, darkRef.current)
          setMode(fallbackRef.current ? "fallback" : "tiles")
        })
      })
      .catch(() => setMode("static"))
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      window.cancelAnimationFrame(frame.current)
      markers.clear()
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  // Dark at night or in dark mode: swap the style (our layers are added back on style.load).
  useEffect(() => {
    darkRef.current = dark
    const map = mapRef.current
    if (!map) return
    map.setStyle(fallbackRef.current ? fallbackStyle(dark) : dark ? mapStyleDarkUrl : mapStyleUrl)
  }, [dark])

  // Route, pickup and drop-off pins, and fitting the map to them.
  const fitKey = `${pickup ?? ""}|${dropoff ?? ""}|${me ? me.map((value) => value.toFixed(3)).join(",") : ""}|${focus}|${center ? center.map((value) => value.toFixed(2)).join(",") : ""}|${Math.round((padding?.bottom ?? 0) / 40)}`
  useEffect(() => {
    const map = mapRef.current
    const lib = libRef.current
    if (!map || !lib || mode === "loading" || mode === "static") return
    const source = map.style ? (map.getSource("flyt-route") as import("maplibre-gl").GeoJSONSource | undefined) : undefined
    source?.setData(pickup && dropoff && pickup !== dropoff ? routeLine(pickup, dropoff) : { type: "FeatureCollection", features: [] })
    const place = (key: "pickup" | "dropoff", id: PlaceId | undefined, className: string) => {
      pins.current[key]?.remove()
      pins.current[key] = id ? new lib.Marker({ element: element(className), anchor: "center" }).setLngLat(placeLngLat(id)).addTo(map) : undefined
    }
    place("pickup", pickup, "flyt-pin flyt-pin-pickup")
    place("dropoff", dropoff, "flyt-pin flyt-pin-dropoff")
    pins.current.me?.remove()
    pins.current.me = me ? new lib.Marker({ element: element("flyt-me"), anchor: "center" }).setLngLat(me).addTo(map) : undefined
    const keep = { top: 72 + (padding?.top ?? 0), bottom: 48 + (padding?.bottom ?? 0), left: 40 + (padding?.left ?? 0), right: 40 + (padding?.right ?? 0) }
    const duration = reducedMotion() ? 0 : 900
    const points = [pickup && placeLngLat(pickup), dropoff && placeLngLat(dropoff)].filter(Boolean) as LngLat[]
    const box = points.length === 2 ? boundsOf(points) : undefined
    try {
      if (box) map.fitBounds(box, { padding: keep, duration, maxZoom: 14.5 })
      else if (points.length === 1) map.easeTo({ center: points[0], zoom: 14, padding: keep, duration })
      else if (me) map.easeTo({ center: me, zoom: 14, padding: keep, duration })
      else if (center) map.easeTo({ center, zoom: 13.4, padding: keep, duration })
      else map.easeTo({ center: KIGALI, zoom: KIGALI_ZOOM, padding: keep, duration })
    } catch {
      // A container with no size yet: the next change fits it.
    }
    // Only when the places or the person's position change, so panning by hand is not undone.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, mode])

  // The searching pulse at the pickup.
  useEffect(() => {
    const map = mapRef.current
    const lib = libRef.current
    pins.current.pulse?.remove()
    pins.current.pulse = undefined
    if (!map || !lib || !searching || !pickup || mode === "loading" || mode === "static") return
    pins.current.pulse = new lib.Marker({ element: element("flyt-pulse", "<span></span><span></span>"), anchor: "center" }).setLngLat(placeLngLat(pickup)).addTo(map)
  }, [searching, pickup, mode])

  // Cars: add, move smoothly, turn to face where they go, and remove.
  useEffect(() => {
    const map = mapRef.current
    const lib = libRef.current
    if (!map || !lib || mode === "loading" || mode === "static") return
    const known = carMarkers.current
    const now = performance.now()
    const seen = new Set<string>()
    for (const item of allCars) {
      seen.add(item.key)
      const existing = known.get(item.key)
      if (!existing) {
        const node = element(`flyt-car ${item.state === "on_trip" ? "flyt-car-busy" : ""}`, carSvg)
        if (item.label) node.title = item.label
        node.setAttribute("aria-hidden", "true")
        known.set(item.key, { marker: new lib.Marker({ element: node, anchor: "center", rotationAlignment: "map" }).setLngLat(item.position).addTo(map), from: item.position, to: item.position, start: now })
        continue
      }
      const current = existing.marker.getLngLat()
      const from: LngLat = [current.lng, current.lat]
      if (from[0] !== item.position[0] || from[1] !== item.position[1]) existing.marker.setRotation(bearing(from, item.position))
      existing.marker.getElement().classList.toggle("flyt-car-busy", item.state === "on_trip")
      Object.assign(existing, { from, to: item.position, start: now })
    }
    for (const [key, entry] of known) {
      if (seen.has(key)) continue
      entry.marker.remove()
      known.delete(key)
    }
    if (reducedMotion()) {
      for (const entry of known.values()) entry.marker.setLngLat(entry.to)
      return
    }
    window.cancelAnimationFrame(frame.current)
    const step = () => {
      const time = performance.now()
      let moving = false
      for (const entry of known.values()) {
        const progress = Math.min(1, (time - entry.start) / MOVE_MS)
        entry.marker.setLngLat(between(entry.from, entry.to, progress))
        if (progress < 1) moving = true
      }
      if (moving) frame.current = window.requestAnimationFrame(step)
    }
    frame.current = window.requestAnimationFrame(step)
  }, [allCars, mode])

  const name = label ?? (pickup ? `${t("map.label")}: ${placeName(pickup)}${dropoff ? ` → ${placeName(dropoff)}` : ""}` : t("map.label"))
  const frameClass = full ? "absolute inset-0" : "relative min-h-48 overflow-hidden rounded-3xl border"
  return (
    <div className={`${frameClass} isolate bg-[#eef3eb] dark:bg-[#1f2622] ${className}`} role="region" aria-label={name} data-map-mode={mode}>
      {mode === "static" ? (
        <StaticMap pickup={pickup} dropoff={dropoff} car={!!car} />
      ) : (
        <>
          {/* Inline position: MapLibre's own CSS sets its container to position: relative. */}
          <div ref={holder} style={{ position: "absolute", inset: 0 }} />
          {(mode === "loading" || mode === "drawing") && <div className="map-grid pointer-events-none absolute inset-0 animate-pulse motion-reduce:animate-none" aria-hidden />}
          {mode === "fallback" && (
            <p className="pointer-events-none absolute left-3 top-3 max-w-[45%] rounded-xl bg-background/90 px-3 py-1.5 text-[11px] leading-tight text-muted-foreground shadow">
              {t("map.simple")}
            </p>
          )}
        </>
      )}
    </div>
  )
}

/** A drawn map for browsers without WebGL. */
function StaticMap({ pickup, dropoff, car }: { pickup?: PlaceId; dropoff?: PlaceId; car: boolean }) {
  const t = useT()
  return (
    <div className="map-grid absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute left-[18%] top-[35%] rounded-full border-4 border-white bg-primary p-2 shadow-lg">
        <MapPin className="size-4 text-primary-foreground" />
      </div>
      {dropoff && (
        <div className="absolute right-[24%] top-[58%] rounded-full border-4 border-white bg-foreground p-2 shadow-lg">
          <MapPin className="size-4 text-background" />
        </div>
      )}
      {car && (
        <div className="absolute left-[57%] top-[23%] grid size-10 place-items-center rounded-xl border-4 border-white bg-white shadow-lg">
          <CarFront className="size-5 text-primary" />
        </div>
      )}
      <div className="absolute bottom-3 left-3 rounded-full bg-background/90 px-3 py-1.5 text-xs font-medium text-foreground shadow">
        {pickup ? placeName(pickup) : t("map.kigali")}
        {dropoff ? ` → ${placeName(dropoff)}` : ` · ${t("map.rwanda")}`}
      </div>
    </div>
  )
}
