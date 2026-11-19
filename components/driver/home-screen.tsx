"use client"

import { AlertTriangle, ChevronRight, MapPinned, Wallet } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { documentStatus } from "@/lib/documents"
import type { DriverEarnings } from "@/lib/driver"
import { formatMoney } from "@/lib/format"
import { useT, type TranslationKey } from "@/lib/i18n"
import { placeName } from "@/lib/places"
import type { Driver, Firm, Trip } from "@/lib/types"

export function DriverHome(props: { driver: Driver; firm?: Firm; earnings: DriverEarnings; toConfirm: Trip[]; busy: boolean; onToggle: (online: boolean) => void; onDocuments: () => void; onOpenTrip: (trip: Trip) => void }) {
  const t = useT()
  const { driver } = props
  const online = driver.status !== "offline"
  const docs = driver.documents.map((doc) => ({ doc, status: documentStatus(doc) })).filter((row) => row.status !== "valid")
  const blocked = driver.approval !== "approved" ? t(`driver.home.blocked.${driver.approval}` as TranslationKey) : docs.some((row) => row.status === "expired" || row.status === "missing" || row.status === "rejected") ? t("driver.home.blocked.documents") : undefined

  return (
    <div className="px-5 pb-8 pt-6">
      <p className="text-sm text-muted-foreground">{props.firm ? t("driver.home.drivingFor", { firm: props.firm.name }) : ""}</p>
      <h1 className="mt-1 text-2xl font-semibold">{t("driver.home.hello", { name: driver.name.split(" ")[0] })}</h1>

      <button
        role="switch"
        aria-checked={online}
        disabled={props.busy || driver.status === "on_trip" || (!online && !!blocked)}
        onClick={() => props.onToggle(!online)}
        className={`mt-5 flex min-h-24 w-full items-center justify-between rounded-3xl px-6 text-left text-xl font-semibold transition disabled:opacity-60 ${online ? "bg-primary text-primary-foreground" : "border-2 bg-card"}`}
      >
        <span>
          {driver.status === "on_trip" ? t("driver.home.onTrip") : online ? t("driver.home.online") : t("driver.home.offline")}
          <span className="block text-sm font-normal opacity-80">{online ? t("driver.home.tapOffline") : t("driver.home.tapOnline")}</span>
        </span>
        <span className={`relative h-9 w-16 rounded-full ${online ? "bg-primary-foreground/30" : "bg-secondary"}`}>
          <span className={`absolute top-1 size-7 rounded-full shadow transition-all ${online ? "left-8 bg-primary-foreground" : "left-1 bg-foreground/60"}`} />
        </span>
      </button>
      {blocked && !online && (
        <p role="alert" className="mt-3 flex items-start gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {blocked}
        </p>
      )}
      {driver.suspendAfterTrip && <p className="mt-3 rounded-xl bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">{t("driver.home.suspendAfterTrip")}</p>}
      {online && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-secondary p-3 text-sm">
          <MapPinned className="mt-0.5 size-4 shrink-0 text-primary" /> {t("driver.home.keepOpen")}
        </p>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs uppercase text-muted-foreground">{t("driver.home.todayFares")}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{formatMoney(props.earnings.today.fares)}</p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs uppercase text-muted-foreground">{t("driver.home.todayTrips")}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{props.earnings.today.trips}</p>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{t("driver.home.zone", { zone: placeName(driver.zone) })}</p>

      {props.toConfirm.length > 0 && (
        <section className="mt-5">
          <h2 className="mb-2 font-semibold">{t("driver.home.toConfirm")}</h2>
          <div className="flex flex-col gap-2">
            {props.toConfirm.map((trip) => (
              <button key={trip.id} onClick={() => props.onOpenTrip(trip)} className="flex min-h-14 items-center gap-3 rounded-2xl border bg-card px-4 text-left">
                <Wallet className="size-5 text-primary" />
                <span className="min-w-0 flex-1 text-sm">
                  <span className="block font-medium">
                    {placeName(trip.pickup)} → {placeName(trip.dropoff)}
                  </span>
                  <span className="text-xs text-muted-foreground">{trip.riderPaidAt ? t("driver.after.riderSaysPaid") : t("driver.after.waitingRider")}</span>
                </span>
                <span className="font-semibold tabular-nums">{formatMoney(trip.fare)}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {docs.length > 0 && (
        <button onClick={props.onDocuments} className="mt-5 flex w-full items-center gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-left">
          <AlertTriangle className="size-5 shrink-0 text-amber-600" />
          <span className="min-w-0 flex-1 text-sm">
            <span className="block font-semibold">{t("driver.home.docsTitle", { count: docs.length })}</span>
            <span className="flex flex-wrap gap-1 pt-1">
              {docs.map(({ doc, status }) => (
                <Badge key={doc.id} variant={status === "expired" || status === "missing" || status === "rejected" ? "destructive" : "outline"}>
                  {t(`doc.${doc.type}` as TranslationKey)}: {t(`status.${status}` as TranslationKey)}
                </Badge>
              ))}
            </span>
          </span>
          <ChevronRight className="size-5 text-muted-foreground" />
        </button>
      )}
    </div>
  )
}
