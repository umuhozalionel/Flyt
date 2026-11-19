"use client"

import { CarFront } from "lucide-react"
import { useT } from "@/lib/i18n"
import { places } from "@/lib/places"
import type { PlaceId } from "@/lib/types"

export interface FleetPin { id: string; label: string; zone: PlaceId; state: "online" | "on_trip" }

const lats = places.map((place) => place.lat ?? 0)
const lngs = places.map((place) => place.lng ?? 0)
const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)]

/** Position of a place inside the map box, in percent, with a margin so pins stay inside. */
function position(id: PlaceId) {
  const place = places.find((item) => item.id === id)
  const x = (((place?.lng ?? minLng) - minLng) / (maxLng - minLng)) * 74 + 10
  const y = ((maxLat - (place?.lat ?? maxLat)) / (maxLat - minLat)) * 76 + 12
  return { x, y }
}

// Live fleet map placeholder: cars are placed at their zone. Kept on its own so a real map can replace it.
export function FleetMap({ pins }: { pins: FleetPin[] }) {
  const t = useT()
  const perZone = new Map<PlaceId, number>()
  return (
    <div className="map-grid relative h-72 overflow-hidden rounded-3xl border bg-[#eef3eb] dark:bg-[#252c27]" role="img" aria-label={t("ops.map.label", { count: pins.length })}>
      {places.map((place) => {
        const { x, y } = position(place.id)
        return (
          <span key={place.id} className="absolute -translate-x-1/2 -translate-y-1/2 text-center" style={{ left: `${x}%`, top: `${y}%` }}>
            <span className="mx-auto block size-1.5 rounded-full bg-foreground/40" />
            <span className="mt-0.5 block whitespace-nowrap text-[10px] font-medium text-muted-foreground">{place.name}</span>
          </span>
        )
      })}
      {pins.map((pin) => {
        const index = perZone.get(pin.zone) ?? 0
        perZone.set(pin.zone, index + 1)
        const { x, y } = position(pin.zone)
        return (
          <span
            key={pin.id}
            title={pin.label}
            className={`absolute grid size-7 -translate-x-1/2 -translate-y-full place-items-center rounded-lg border-2 border-white shadow ${pin.state === "on_trip" ? "bg-sky-600 text-white" : "bg-primary text-primary-foreground"}`}
            style={{ left: `calc(${x}% + ${index * 16}px)`, top: `calc(${y}% - 4px)` }}
          >
            <CarFront className="size-4" />
          </span>
        )
      })}
      <div className="absolute bottom-3 left-3 flex gap-3 rounded-full bg-background/90 px-3 py-1.5 text-xs shadow">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-primary" /> {t("ops.map.online")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-sky-600" /> {t("ops.map.onTrip")}
        </span>
      </div>
    </div>
  )
}
