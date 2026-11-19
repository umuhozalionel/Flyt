"use client"

import { MapPin, Trash2 } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/shared/empty-state"
import { useT } from "@/lib/i18n"
import { placeName, places } from "@/lib/places"
import type { PlaceId, Rider, SavedPlace } from "@/lib/types"

export function SavedPlacesScreen({ rider, busy, onSave }: { rider: Rider; busy: boolean; onSave: (places: SavedPlace[]) => Promise<void> }) {
  const t = useT()
  const [label, setLabel] = useState("")
  const [placeId, setPlaceId] = useState<PlaceId>("city-centre")

  async function add() {
    const name = label.trim()
    if (!name) return
    await onSave([...rider.savedPlaces, { id: `sp-${Date.now()}`, label: name, placeId }])
    setLabel("")
  }

  return (
    <div className="px-5 pb-8 pt-6">
      <h1 className="text-2xl font-semibold">{t("rider.places.title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("rider.places.detail")}</p>
      <div className="mt-5 flex flex-col gap-2">
        {rider.savedPlaces.length === 0 && <EmptyState title={t("rider.places.emptyTitle")} detail={t("rider.places.emptyDetail")} />}
        {rider.savedPlaces.map((place) => (
          <div key={place.id} className="flex min-h-14 items-center gap-3 rounded-2xl border bg-card px-4">
            <MapPin className="size-4 text-muted-foreground" />
            <span className="flex-1">
              <span className="block text-sm font-semibold">{place.label}</span>
              <span className="block text-xs text-muted-foreground">{placeName(place.placeId)}</span>
            </span>
            <button disabled={busy} onClick={() => void onSave(rider.savedPlaces.filter((item) => item.id !== place.id))} className="grid size-11 place-items-center rounded-full hover:bg-secondary" aria-label={t("rider.places.remove", { label: place.label })}>
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
      </div>
      <div className="mt-6 rounded-2xl border bg-card p-4">
        <h2 className="font-semibold">{t("rider.places.add")}</h2>
        <label htmlFor="place-label" className="mt-3 block text-sm font-medium">
          {t("rider.places.label")}
        </label>
        <input id="place-label" value={label} onChange={(event) => setLabel(event.target.value)} placeholder={t("rider.places.labelPlaceholder")} className="mt-2 min-h-12 w-full rounded-xl border bg-background px-4 outline-none" />
        <label htmlFor="place-id" className="mt-3 block text-sm font-medium">
          {t("rider.places.place")}
        </label>
        <select id="place-id" value={placeId} onChange={(event) => setPlaceId(event.target.value as PlaceId)} className="mt-2 min-h-12 w-full rounded-xl border bg-background px-3">
          {places.map((place) => (
            <option key={place.id} value={place.id}>
              {place.name}
            </option>
          ))}
        </select>
        <Button className="mt-4 min-h-12 w-full" disabled={!label.trim() || busy} onClick={() => void add()}>
          {t("rider.places.save")}
        </Button>
      </div>
    </div>
  )
}
