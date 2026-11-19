"use client"

import { Info } from "lucide-react"
import { TripCard } from "@/components/shared/trip-card"
import type { DriverEarnings } from "@/lib/driver"
import { formatMoney } from "@/lib/format"
import { useT } from "@/lib/i18n"
import type { Trip } from "@/lib/types"

export function EarningsScreen({ earnings, trips, onOpen }: { earnings: DriverEarnings; trips: Trip[]; onOpen: (trip: Trip) => void }) {
  const t = useT()
  const done = trips.filter((trip) => trip.status === "completed")
  const rows = [
    ["driver.earnings.today", earnings.today],
    ["driver.earnings.week", earnings.week],
    ["driver.earnings.month", earnings.month],
  ] as const
  return (
    <div className="px-5 pb-8 pt-6">
      <h1 className="text-2xl font-semibold">{t("driver.earnings.title")}</h1>
      <div className="mt-4 grid grid-cols-1 gap-3">
        {rows.map(([key, period]) => (
          <div key={key} className="flex items-center justify-between rounded-2xl border bg-card p-4">
            <span>
              <span className="block text-sm text-muted-foreground">{t(key)}</span>
              <span className="text-xs text-muted-foreground">{t("driver.earnings.trips", { count: period.trips })}</span>
            </span>
            <span className="text-right">
              <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("driver.earnings.fares")}</span>
              <span className="text-2xl font-semibold tabular-nums">{formatMoney(period.fares)}</span>
            </span>
          </div>
        ))}
      </div>
      <p className="mt-3 flex items-start gap-2 rounded-xl bg-secondary p-3 text-sm">
        <Info className="mt-0.5 size-4 shrink-0" /> {t("driver.earnings.payoutNote")}
      </p>
      <h2 className="mt-6 font-semibold">{t("driver.earnings.list")}</h2>
      <div className="mt-2 flex flex-col gap-2">
        {done.length ? done.map((trip) => <TripCard key={trip.id} trip={trip} onClick={() => onOpen(trip)} />) : <p className="text-sm text-muted-foreground">{t("ops.drivers.noTrips")}</p>}
      </div>
    </div>
  )
}
