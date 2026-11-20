"use client"

import { MapView, type MapCar } from "@/components/shared/map-view"
import { useT } from "@/lib/i18n"
import { carPosition } from "@/lib/map"
import type { PlaceId } from "@/lib/types"
import { useNow } from "@/lib/use-now"

export interface FleetPin { id: string; label: string; zone: PlaceId; state: "online" | "on_trip" }

/**
 * The Ops live map: every online car, moving slowly around its zone (drivers share their zone, not GPS, in
 * version 1). Free cars are green, cars on a trip are amber. Hover a car for the driver and plate.
 */
export function FleetMap({ pins }: { pins: FleetPin[] }) {
  const t = useT()
  const now = useNow(3000)
  const cars: MapCar[] = pins.map((pin) => ({ key: pin.id, position: carPosition(pin.id, pin.zone, now), state: pin.state === "on_trip" ? "on_trip" : "free", label: pin.label }))
  return (
    <div className="relative h-80 overflow-hidden rounded-3xl border md:h-[440px]">
      <MapView full cars={cars} label={t("ops.map.label", { count: pins.length })} />
      <div className="absolute bottom-3 left-3 z-[5] flex gap-3 rounded-full bg-background/90 px-3 py-1.5 text-xs shadow">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-[#13925f]" /> {t("ops.map.online")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-[#c47f12]" /> {t("ops.map.onTrip")}
        </span>
      </div>
    </div>
  )
}
