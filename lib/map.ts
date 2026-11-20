import { driveMinutes, kmBetween, pickupMinutes } from "./eta"
import { places } from "./places"
import type { PlaceId, Trip } from "./types"

// Pure map helpers (no MapLibre here), so they can be tested and the map provider can be swapped.
// Positions are [lng, lat], the order MapLibre and GeoJSON use.

export type LngLat = [number, number]

/** Kigali city centre, used when the rider's location is not shared. */
export const KIGALI: LngLat = [30.0619, -1.9441]
export const KIGALI_ZOOM = 12.2

/** A place's position, or the city centre for a place without one. */
export function placeLngLat(id: PlaceId | undefined): LngLat {
  const place = places.find((item) => item.id === id)
  return place?.lng != null && place.lat != null ? [place.lng, place.lat] : KIGALI
}

/** Roughly the area the 10 places cover, with a margin. Locations outside it centre on Kigali instead. */
export const KIGALI_BOUNDS: [LngLat, LngLat] = [
  [30.0, -2.02],
  [30.18, -1.88],
]

export function inKigali([lng, lat]: LngLat) {
  return lng >= KIGALI_BOUNDS[0][0] && lng <= KIGALI_BOUNDS[1][0] && lat >= KIGALI_BOUNDS[0][1] && lat <= KIGALI_BOUNDS[1][1]
}

/** The nearest of our places to a position (for "Use my location" as pickup). */
export function nearestPlace([lng, lat]: LngLat): PlaceId {
  let best = places[0]
  let bestDistance = Infinity
  for (const place of places) {
    if (place.lat == null || place.lng == null) continue
    const distance = (place.lat - lat) ** 2 + ((place.lng - lng) * Math.cos((lat * Math.PI) / 180)) ** 2
    if (distance < bestDistance) {
      best = place
      bestDistance = distance
    }
  }
  return best.id
}

/** A small stable number from a string, used to spread cars around their zone. */
export function hashOf(text: string) {
  let hash = 2166136261
  for (let index = 0; index < text.length; index++) hash = Math.imul(hash ^ text.charCodeAt(index), 16777619)
  return hash >>> 0
}

const METRES_PER_DEGREE = 111_320

/**
 * Where to draw a car that is in a zone. Drivers share their zone, not GPS, so each car is drawn on a slow loop
 * 250 to 650 m around its zone, at a spot fixed by its key. It looks alive without claiming a real position.
 */
export function carPosition(key: string, zone: PlaceId, now: number): LngLat {
  const [lng, lat] = placeLngLat(zone)
  const hash = hashOf(key)
  const radius = 250 + (hash % 400)
  const period = 240_000 + (hash % 120_000) // one loop every 4 to 6 minutes
  const direction = hash % 2 ? 1 : -1
  const angle = ((hash % 360) * Math.PI) / 180 + direction * ((now % period) / period) * Math.PI * 2
  const dLat = (radius * Math.sin(angle)) / METRES_PER_DEGREE
  const dLng = (radius * Math.cos(angle)) / (METRES_PER_DEGREE * Math.cos((lat * Math.PI) / 180))
  return [round(lng + dLng), round(lat + dLat)]
}

/** Compass bearing in degrees from one point to another (0 is north), to turn car icons. */
export function bearing(from: LngLat, to: LngLat) {
  const [lng1, lat1] = from.map((value) => (value * Math.PI) / 180)
  const [lng2, lat2] = to.map((value) => (value * Math.PI) / 180)
  const y = Math.sin(lng2 - lng1) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lng2 - lng1)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

/** A point part of the way along a straight line (t from 0 to 1). */
export function between(from: LngLat, to: LngLat, t: number): LngLat {
  return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t]
}

/** The route drawn between pickup and drop-off: a simple straight line (no paid routing). */
export function routeLine(pickup: PlaceId, dropoff: PlaceId) {
  return { type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: [placeLngLat(pickup), placeLngLat(dropoff)] } }
}

/** Bounds that hold all the given points, for fitting the map. */
export function boundsOf(points: LngLat[]): [LngLat, LngLat] | undefined {
  if (!points.length) return undefined
  const lngs = points.map((point) => point[0])
  const lats = points.map((point) => point[1])
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ]
}

/** Night in Kigali (Africa/Kigali is UTC+2 all year): from 18:30 to 06:00 the map uses its dark style. */
export function isKigaliNight(now: number) {
  const minutes = (Math.floor(now / 60_000) + 120) % 1440
  return minutes >= 18 * 60 + 30 || minutes < 6 * 60
}

/**
 * Where to draw the car on a trip, from the timeline and the time estimates (there is no live GPS in version 1):
 * on its way it moves from the driver's zone to the pickup, then sits at the pickup, then moves to the drop-off.
 */
export function tripCarPosition(trip: Pick<Trip, "status" | "pickup" | "dropoff" | "acceptedAt" | "startedAt" | "distanceKm">, driverZone: PlaceId | undefined, now: number): LngLat | undefined {
  const pickup = placeLngLat(trip.pickup)
  const progress = (since: string | undefined, minutes: number) => (since && minutes > 0 ? Math.min(0.97, Math.max(0, (now - Date.parse(since)) / (minutes * 60_000))) : 0)
  if (trip.status === "assigned" || trip.status === "driver_arriving") {
    const from = placeLngLat(driverZone ?? trip.pickup)
    if (trip.status === "assigned" || !driverZone || driverZone === trip.pickup) return trip.status === "assigned" ? from : between(from, pickup, 0.97)
    return between(from, pickup, progress(trip.acceptedAt, pickupMinutes(kmBetween(driverZone, trip.pickup))))
  }
  if (trip.status === "driver_arrived") return pickup
  if (trip.status === "in_progress") return between(pickup, placeLngLat(trip.dropoff), progress(trip.startedAt, driveMinutes(trip.distanceKm)))
  return undefined
}

function round(value: number) {
  return Math.round(value * 1e6) / 1e6
}
