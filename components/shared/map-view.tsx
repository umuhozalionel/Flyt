"use client"

import { CarFront, MapPin } from "lucide-react"
import { useT } from "@/lib/i18n"
import { placeName } from "@/lib/places"
import type { PlaceId } from "@/lib/types"

// Map placeholder. Kept on its own so a real map can replace it later without touching screens.
export function MapView({ pickup, dropoff, car = false }: { pickup?: PlaceId; dropoff?: PlaceId; car?: boolean }) {
  const t = useT()
  return (
    <div className="map-grid relative isolate min-h-48 overflow-hidden rounded-3xl border bg-[#eef3eb] dark:bg-[#252c27]" role="img" aria-label={t("map.label")}>
      <div
        className="absolute inset-0 opacity-60 dark:opacity-15"
        style={{
          backgroundImage:
            "linear-gradient(32deg,transparent 46%,rgba(255,255,255,.9) 47%,rgba(255,255,255,.9) 49%,transparent 50%),linear-gradient(112deg,transparent 40%,rgba(255,255,255,.85) 41%,rgba(255,255,255,.85) 43%,transparent 44%),linear-gradient(0deg,transparent 70%,rgba(255,255,255,.65) 71%,rgba(255,255,255,.65) 73%,transparent 74%)",
          backgroundSize: "170px 130px, 220px 190px, 100% 100%",
        }}
      />
      <div className="absolute left-[18%] top-[35%] rounded-full border-4 border-white bg-primary p-2 shadow-lg">
        <MapPin className="size-4 text-primary-foreground" />
      </div>
      <div className="absolute right-[24%] top-[58%] rounded-full border-4 border-white bg-foreground p-2 shadow-lg">
        <MapPin className="size-4 text-background" />
      </div>
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
