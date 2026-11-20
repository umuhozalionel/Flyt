"use client"

import { LocateFixed, MapPinOff } from "lucide-react"
import { useState } from "react"
import { MapView, type MapCar } from "@/components/shared/map-view"
import * as api from "@/lib/api"
import { useT } from "@/lib/i18n"
import { carPosition, tripCarPosition, type LngLat } from "@/lib/map"
import type { LocationState } from "@/lib/use-location"
import { useLive } from "@/lib/use-live"
import { useNow } from "@/lib/use-now"
import type { BookingDraft, Screen, TripAssignment } from "./types"

/** The full-screen map behind the rider's home, booking, finding and trip screens. */
export function RiderMap({ screen, draft, current, me, location, onLocate, sheetHeight }: { screen: Screen; draft: BookingDraft; current?: TripAssignment; me: LngLat | null; location: LocationState; onLocate: () => void; sheetHeight: number }) {
  const t = useT()
  const now = useNow(3000)
  const [focus, setFocus] = useState(0)
  const showFree = screen === "home" || screen === "book" || screen === "finding"
  const free = useLive(() => (showFree ? api.getFreeCars() : Promise.resolve([])), ["drivers", "cars", "firms", "trips"], [showFree])
  const cars: MapCar[] = (free.data ?? []).map((item) => ({ key: item.key, position: carPosition(item.key, item.zone, now), state: "free" }))

  const trip = current?.trip
  const onTrip = screen === "trip" && trip
  const pickup = onTrip || screen === "finding" ? trip?.pickup : screen === "book" ? draft.pickup : undefined
  const dropoff = onTrip || screen === "finding" ? trip?.dropoff : screen === "book" ? draft.dropoff : undefined
  const tripCar = onTrip ? tripCarPosition(trip, current?.driver?.zone, now) : undefined

  return (
    <>
      <MapView full pickup={pickup} dropoff={dropoff} cars={onTrip ? [] : cars} car={tripCar} me={me} searching={screen === "finding" && trip?.status === "requested"} padding={{ bottom: sheetHeight }} focus={focus} />
      {screen === "home" && (
        <div className="absolute right-3 top-3 z-[5]">
          {location === "on" ? (
            <button onClick={() => setFocus((value) => value + 1)} className="grid size-11 place-items-center rounded-full bg-background shadow-lg" aria-label={t("location.centre")}>
              <LocateFixed className="size-5 text-primary" />
            </button>
          ) : location === "denied" || location === "outside" || location === "unavailable" ? (
            <p className="flex max-w-[220px] items-center gap-2 rounded-full bg-background/95 px-3 py-2 text-xs text-muted-foreground shadow-lg">
              <MapPinOff className="size-4 shrink-0" /> {t(`location.${location}`)}
            </p>
          ) : (
            <button onClick={onLocate} disabled={location === "asking"} className="flex min-h-11 items-center gap-2 rounded-full bg-background px-4 text-sm font-semibold shadow-lg">
              <LocateFixed className="size-4 text-primary" /> {location === "asking" ? t("location.asking") : t("location.use")}
            </button>
          )}
        </div>
      )}
    </>
  )
}
