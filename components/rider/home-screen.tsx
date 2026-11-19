"use client"

import { ArrowRight, CarFront, Home, MapPin, Plus } from "lucide-react"
import { EmptyState } from "@/components/shared/empty-state"
import { MapView } from "@/components/shared/map-view"
import { Skeleton } from "@/components/shared/skeleton"
import { TripCard } from "@/components/shared/trip-card"
import { useT } from "@/lib/i18n"
import { placeName } from "@/lib/places"
import { kigaliHour } from "@/lib/time"
import type { PlaceId, Rider, Trip } from "@/lib/types"

export function HomeScreen(props: {
  rider: Rider
  recentTrips?: Trip[]
  activeTrip?: Trip
  onBook: () => void
  onSavedPlace: (placeId: PlaceId) => void
  onOpenTrip: (trip: Trip) => void
  onOpenActive: () => void
  onSeeAll: () => void
  onAddPlace: () => void
}) {
  const t = useT()
  const { rider, recentTrips, activeTrip } = props
  return (
    <div className="animate-in fade-in duration-200">
      <div className="px-5 pb-5 pt-6">
        <p className="text-sm text-muted-foreground">{kigaliHour() < 12 ? t("rider.home.goodMorning") : t("rider.home.goodAfternoon")}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{t("rider.home.whereTo", { name: rider.name.split(" ")[0] })}</h1>
      </div>
      <div className="px-4">
        <button onClick={props.onBook} className="flex min-h-16 w-full items-center gap-3 rounded-2xl border bg-card px-4 text-left shadow-sm">
          <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground">
            <MapPin className="size-5" />
          </span>
          <span className="flex-1 font-medium">{t("rider.home.whereGoing")}</span>
          <ArrowRight className="size-5 text-muted-foreground" />
        </button>
      </div>
      <div className="px-4 pt-4">
        <MapView />
      </div>
      {activeTrip && (
        <button onClick={props.onOpenActive} className="mx-4 mt-4 flex w-[calc(100%-32px)] items-center gap-3 rounded-2xl bg-primary p-4 text-left text-primary-foreground">
          <span className="grid size-10 place-items-center rounded-xl bg-white/15">
            <CarFront className="size-5" />
          </span>
          <span className="flex-1">
            <span className="block text-xs opacity-80">{activeTrip.status === "requested" ? t("rider.home.findingRide") : t("rider.home.activeRide")}</span>
            <span className="font-semibold">{t("common.route", { from: placeName(activeTrip.pickup), to: placeName(activeTrip.dropoff) })}</span>
          </span>
          <ArrowRight className="size-5" />
        </button>
      )}
      <section className="px-5 pt-7">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("rider.home.savedPlaces")}</h2>
          <button onClick={props.onAddPlace} className="grid size-9 place-items-center rounded-full hover:bg-secondary" aria-label={t("rider.home.addSavedPlace")}>
            <Plus className="size-5" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {rider.savedPlaces.length === 0 && (
            <button onClick={props.onAddPlace} className="col-span-2 min-h-14 rounded-2xl border border-dashed text-sm text-muted-foreground">
              {t("rider.home.addSavedPlace")}
            </button>
          )}
          {rider.savedPlaces.map((place, i) => (
            <button key={place.id} onClick={() => props.onSavedPlace(place.placeId)} className="flex min-w-0 items-center gap-3 rounded-2xl border bg-card p-3 text-left">
              <span className="grid size-10 place-items-center rounded-xl bg-secondary">{i === 0 ? <Home className="size-4" /> : <MapPin className="size-4" />}</span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{place.label}</span>
                <span className="block truncate text-xs text-muted-foreground">{placeName(place.placeId)}</span>
              </span>
            </button>
          ))}
        </div>
      </section>
      <section className="px-5 pb-5 pt-7">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("rider.home.recentTrips")}</h2>
          <button onClick={props.onSeeAll} className="text-sm font-semibold text-primary">
            {t("rider.home.seeAll")}
          </button>
        </div>
        {!recentTrips ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        ) : recentTrips.length ? (
          <div className="flex flex-col gap-2">
            {recentTrips.slice(0, 2).map((item) => (
              <TripCard key={item.id} trip={item} onClick={() => props.onOpenTrip(item)} />
            ))}
          </div>
        ) : (
          <EmptyState title={t("rider.home.emptyTitle")} detail={t("rider.home.emptyDetail")} action={{ label: t("rider.home.bookRide"), onClick: props.onBook }} />
        )}
      </section>
    </div>
  )
}
