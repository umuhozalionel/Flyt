"use client"

import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/shared/empty-state"
import { MapView } from "@/components/shared/map-view"
import { formatMoney } from "@/lib/format"
import { useT } from "@/lib/i18n"
import { placeName } from "@/lib/places"
import type { Trip } from "@/lib/types"

export function FindingScreen({ trip, onCancel, onEdit, onHome }: { trip?: Trip; onCancel: () => void; onEdit: () => void; onHome: () => void }) {
  const t = useT()
  const none = trip?.status === "no_driver_found"
  return (
    <div className="flex min-h-[75vh] flex-col px-5 pb-8 pt-7">
      <h1 className="text-2xl font-semibold">{none ? t("rider.finding.noCarsTitle") : t("rider.finding.title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{none ? t("rider.finding.noCarsDetail") : t("rider.finding.checking")}</p>
      <div className="mt-5">
        <MapView pickup={trip?.pickup} dropoff={trip?.dropoff} />
      </div>
      {none ? (
        <>
          <EmptyState title={t("rider.finding.noDriversTitle")} detail={t("rider.finding.noDriversDetail")} action={{ label: t("rider.finding.edit"), onClick: onEdit }} />
          <Button variant="outline" className="mt-3 min-h-12" onClick={onHome}>
            {t("rider.finding.backHome")}
          </Button>
        </>
      ) : (
        <div className="mt-auto rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{trip ? `${placeName(trip.pickup)} → ${placeName(trip.dropoff)}` : ""}</span>
            <span className="font-bold">{formatMoney(trip?.fare ?? 0)}</span>
          </div>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-secondary">
            <div className="h-full w-2/3 animate-pulse rounded-full bg-primary" />
          </div>
          <button onClick={onCancel} className="mt-4 min-h-11 w-full rounded-xl py-3 text-sm font-semibold">
            {t("rider.finding.cancel")}
          </button>
        </div>
      )}
    </div>
  )
}
