"use client"

import { EmptyState } from "@/components/shared/empty-state"
import { Skeleton } from "@/components/shared/skeleton"
import { TripCard } from "@/components/shared/trip-card"
import { useT } from "@/lib/i18n"
import type { Trip } from "@/lib/types"

export function TripsScreen({ trips, onOpen, onBook }: { trips?: Trip[]; onOpen: (trip: Trip) => void; onBook: () => void }) {
  const t = useT()
  return (
    <div className="px-5 pb-8 pt-6">
      <h1 className="text-2xl font-semibold">{t("rider.trips.title")}</h1>
      <div className="mt-5 flex flex-col gap-2">
        {!trips && <Skeleton className="h-20" />}
        {trips?.map((item) => <TripCard key={item.id} trip={item} onClick={() => onOpen(item)} />)}
        {trips && trips.length === 0 && <EmptyState title={t("rider.trips.emptyTitle")} detail={t("rider.trips.emptyDetail")} action={{ label: t("rider.trips.bookFirst"), onClick: onBook }} />}
      </div>
    </div>
  )
}
