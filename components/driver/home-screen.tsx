"use client"

import { AlertTriangle, ChevronRight, MapPinned, Wallet } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { documentStatus } from "@/lib/documents"
import type { DriverEarnings } from "@/lib/driver"
import { formatMoney } from "@/lib/format"
import { haptic } from "@/lib/haptics"
import { useT, type TranslationKey } from "@/lib/i18n"
import { placeName } from "@/lib/places"
import type { Driver, Firm, Trip } from "@/lib/types"
import { DriverHomeExtras } from "./home-extras"

/** Why a driver cannot go online, if they cannot. */
function blockedReason(driver: Driver, t: ReturnType<typeof useT>) {
  const docs = driver.documents.map((doc) => documentStatus(doc))
  if (driver.approval !== "approved") return t(`driver.home.blocked.${driver.approval}` as TranslationKey)
  if (docs.some((status) => status === "expired" || status === "missing" || status === "rejected")) return t("driver.home.blocked.documents")
  return undefined
}

/** The big "Go online" button over the map. */
export function PresenceButton({ driver, busy, onToggle }: { driver: Driver; busy: boolean; onToggle: (online: boolean) => void }) {
  const t = useT()
  const online = driver.status !== "offline"
  const blocked = blockedReason(driver, t)
  return (
    <button
      role="switch"
      aria-checked={online}
      disabled={busy || driver.status === "on_trip" || (!online && !!blocked)}
      onClick={() => {
        haptic(online ? "light" : "success")
        onToggle(!online)
      }}
      className={`flex min-h-20 w-full items-center justify-between gap-4 rounded-[28px] px-6 text-left text-xl font-semibold shadow-xl transition active:scale-[0.98] disabled:opacity-70 ${online ? "bg-primary text-primary-foreground" : "bg-background"}`}
    >
      <span>
        {driver.status === "on_trip" ? t("driver.home.onTrip") : online ? t("driver.home.online") : t("driver.map.goOnline")}
        <span className="block text-sm font-normal opacity-80">{online ? t("driver.home.tapOffline") : t("driver.home.tapOnline")}</span>
      </span>
      <span className={`relative h-9 w-16 shrink-0 rounded-full ${online ? "bg-primary-foreground/30" : "bg-secondary"}`}>
        <span className={`absolute top-1 size-7 rounded-full shadow transition-all ${online ? "left-8 bg-primary-foreground" : "left-1 bg-foreground/60"}`} />
      </span>
    </button>
  )
}

export function DriverHome(props: { driver: Driver; firm?: Firm; earnings: DriverEarnings; toConfirm: Trip[]; onDocuments: () => void; onOpenTrip: (trip: Trip) => void }) {
  const t = useT()
  const { driver } = props
  const online = driver.status !== "offline"
  const docs = driver.documents.map((doc) => ({ doc, status: documentStatus(doc) })).filter((row) => row.status !== "valid")
  const blocked = blockedReason(driver, t)

  return (
    <div className="px-5 pb-6 pt-1">
      <p className="text-sm text-muted-foreground">{props.firm ? t("driver.home.drivingFor", { firm: props.firm.name }) : ""}</p>
      <h1 className="mt-1 text-2xl font-semibold">{t("driver.home.hello", { name: driver.name.split(" ")[0] })}</h1>
      <div className="mt-3" />

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
      <DriverHomeExtras driver={driver} />

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
