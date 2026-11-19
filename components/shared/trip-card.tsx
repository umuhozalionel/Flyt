"use client"

import { CarFront } from "lucide-react"
import { formatDay, formatMoney } from "@/lib/format"
import { useT } from "@/lib/i18n"
import { placeName } from "@/lib/places"
import type { Trip } from "@/lib/types"
import { StatusBadge } from "./status-badge"

export function TripCard({ trip, onClick }: { trip: Trip; onClick?: () => void }) {
  const t = useT()
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-2xl border bg-card p-4 text-left transition hover:border-primary/40">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary">
        <CarFront className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">
          {placeName(trip.pickup)} <span className="text-muted-foreground">{t("common.to")}</span> {placeName(trip.dropoff)}
        </span>
        <span className="mt-1 block text-xs text-muted-foreground">
          {formatDay(trip.scheduledFor ?? trip.createdAt)} · {t("common.km", { km: trip.distanceKm })}
        </span>
      </span>
      <span className="text-right">
        <span className="block font-bold">{formatMoney(trip.fare)}</span>
        <span className="mt-1 block">
          <StatusBadge status={trip.status} />
        </span>
      </span>
    </button>
  )
}
