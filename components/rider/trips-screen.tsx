"use client"

import { useState } from "react"
import { EmptyState } from "@/components/shared/empty-state"
import { Skeleton } from "@/components/shared/skeleton"
import { TripCard } from "@/components/shared/trip-card"
import { useT, type TranslationKey } from "@/lib/i18n"
import { cancelledStatuses } from "@/lib/trip-rules"
import type { Trip } from "@/lib/types"

type Tab = "upcoming" | "past" | "cancelled"
const tabs: { id: Tab; label: TranslationKey }[] = [
  { id: "upcoming", label: "rider.trips.upcoming" },
  { id: "past", label: "rider.trips.past" },
  { id: "cancelled", label: "rider.trips.cancelled" },
]

export function tripTab(trip: Trip): Tab {
  if (trip.status === "completed") return "past"
  if (cancelledStatuses.includes(trip.status)) return "cancelled"
  return "upcoming"
}

export function TripsScreen({ trips, onOpen, onBook }: { trips?: Trip[]; onOpen: (trip: Trip) => void; onBook: () => void }) {
  const t = useT()
  const [tab, setTab] = useState<Tab>("upcoming")
  const shown = trips?.filter((trip) => tripTab(trip) === tab)
  return (
    <div className="px-5 pb-8 pt-6">
      <h1 className="text-2xl font-semibold">{t("rider.trips.title")}</h1>
      <div role="tablist" aria-label={t("rider.trips.title")} className="mt-4 grid grid-cols-3 gap-1 rounded-xl bg-secondary p-1">
        {tabs.map((item) => (
          <button key={item.id} role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)} className={`min-h-10 rounded-lg text-sm font-medium ${tab === item.id ? "bg-background shadow-sm" : "text-muted-foreground"}`}>
            {t(item.label)}
            {trips && <span className="ml-1 text-xs text-muted-foreground">{trips.filter((trip) => tripTab(trip) === item.id).length}</span>}
          </button>
        ))}
      </div>
      <div className="mt-4 flex flex-col gap-2" role="tabpanel">
        {!shown && (
          <>
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </>
        )}
        {shown?.map((item) => <TripCard key={item.id} trip={item} onClick={() => onOpen(item)} />)}
        {shown && shown.length === 0 && (
          <EmptyState
            title={tab === "upcoming" ? t("rider.trips.emptyUpcoming") : tab === "past" ? t("rider.trips.emptyTitle") : t("rider.trips.emptyCancelled")}
            detail={t("rider.trips.emptyDetail")}
            action={tab === "upcoming" ? { label: t("rider.trips.bookFirst"), onClick: onBook } : undefined}
          />
        )}
      </div>
    </div>
  )
}
