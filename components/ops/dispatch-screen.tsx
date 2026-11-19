"use client"

import { Clock3, MapPin, Star, UserRound } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { StatusBadge } from "@/components/shared/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import * as api from "@/lib/api"
import { demoAutoDispatch } from "@/lib/config"
import { formatDate, formatMoney, formatTime } from "@/lib/format"
import { useT, type TranslationKey } from "@/lib/i18n"
import { suggestDrivers } from "@/lib/ops"
import { placeName } from "@/lib/places"
import { reassignableStatuses } from "@/lib/trip-rules"
import type { Trip } from "@/lib/types"
import { useAutoDispatch } from "@/lib/use-demo"
import { useNow } from "@/lib/use-now"
import { errorText, useOps } from "./ops-context"
import { useOpsData, type OpsData } from "./ops-data"
import { CancelTripDialog, LoadError, Loading, PageHeader } from "./ops-ui"


export function DispatchScreen() {
  const t = useT()
  const { data, error } = useOpsData()
  const { scope, toast } = useOps()
  const now = useNow()
  const [busy, setBusy] = useState<string>()
  const [cancelling, setCancelling] = useState<string>()
  const [reassigning, setReassigning] = useState<string>()
  const [auto, setAuto] = useAutoDispatch()

  // An offer past its 20 seconds is expired on the next read, which sends the trip back to the queue.
  const overdue = data?.offers.some((offer) => offer.status === "pending" && Date.parse(offer.expiresAt) <= now)
  useEffect(() => {
    if (overdue) void api.getOffers()
  }, [overdue])

  if (error && !data) return <LoadError error={error} />
  if (!data) return <Loading />

  async function run(key: string, action: () => Promise<unknown>, done: string) {
    setBusy(key)
    try {
      await action()
      toast(done)
      return true
    } catch (caught) {
      toast(errorText(caught, t("ops.actionFailed")))
      return false
    } finally {
      setBusy(undefined)
    }
  }

  const byTime = (a: Trip, b: Trip) => (a.scheduledFor ?? a.createdAt).localeCompare(b.scheduledFor ?? b.createdAt)
  const waiting = data.trips.filter((trip) => trip.status === "requested").sort(byTime)
  const scheduled = data.trips.filter((trip) => trip.status === "scheduled").sort(byTime)
  const accepting = data.trips.filter((trip) => trip.status === "assigned").sort(byTime)
  const arriving = data.trips.filter((trip) => trip.status === "driver_arriving").sort(byTime)

  const card = (trip: Trip) => (
    <DispatchCard
      key={trip.id}
      trip={trip}
      data={data}
      now={now}
      busy={busy}
      reassigning={reassigning === trip.id}
      onReassignToggle={() => setReassigning((current) => (current === trip.id ? undefined : trip.id))}
      onAssign={(driverId) =>
        void run(
          `${trip.id}-${driverId}`,
          () => (reassignableStatuses.includes(trip.status) ? api.reassignDriver(trip.id, driverId) : api.assignDriver(trip.id, driverId)),
          t(reassignableStatuses.includes(trip.status) ? "ops.dispatch.reassigned" : "ops.dispatch.assigned", { id: trip.id }),
        ).then((ok) => ok && setReassigning(undefined))
      }
      onDemoAccept={(offerId) => void run(`${trip.id}-accept`, () => api.respondOffer(offerId, true), t("ops.dispatch.accepted", { id: trip.id }))}
      onCancel={() => setCancelling(trip.id)}
      scopeFirm={scope.firmId}
      demo={auto}
    />
  )

  return (
    <>
      <PageHeader
        title={t("ops.dispatch.title")}
        detail={t("ops.dispatch.detail")}
        action={
          demoAutoDispatch ? (
            <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border bg-card px-3 text-sm">
              <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={auto} onChange={(event) => setAuto(event.target.checked)} />
              {t("ops.dispatch.autoDemo")}
            </label>
          ) : undefined
        }
      />
      {demoAutoDispatch && auto && <p className="-mt-2 mb-4 rounded-xl bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">{t("ops.dispatch.autoOnNote")}</p>}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Column title={t("ops.dispatch.waiting", { count: waiting.length })} empty={t("ops.dispatch.noneWaiting")}>
          {waiting.map(card)}
        </Column>
        <Column title={t("ops.dispatch.accepting", { count: accepting.length })} empty={t("ops.dispatch.noneAccepting")}>
          {accepting.map(card)}
        </Column>
        <Column title={t("ops.dispatch.scheduled", { count: scheduled.length })} empty={t("ops.dispatch.noneScheduled")}>
          {scheduled.map(card)}
        </Column>
        <Column title={t("ops.dispatch.arriving", { count: arriving.length })} empty={t("ops.dispatch.noneArriving")}>
          {arriving.map(card)}
        </Column>
      </div>
      {cancelling && (
        <CancelTripDialog
          tripId={cancelling}
          busy={busy === `${cancelling}-cancel`}
          onClose={() => setCancelling(undefined)}
          onConfirm={(reason) => void run(`${cancelling}-cancel`, () => api.cancelTrip(cancelling, "ops", reason), t("ops.dispatch.cancelled", { id: cancelling })).then((ok) => ok && setCancelling(undefined))}
        />
      )}
    </>
  )
}

function Column({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] }) {
  return (
    <section aria-label={title}>
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <div className="flex flex-col gap-3">{children.length ? children : <p className="rounded-2xl border border-dashed p-5 text-center text-sm text-muted-foreground">{empty}</p>}</div>
    </section>
  )
}

function DispatchCard(props: {
  trip: Trip
  data: OpsData
  now: number
  busy?: string
  reassigning: boolean
  scopeFirm?: string
  /** Mock demo toggle is on: show the button that accepts for the driver. */
  demo: boolean
  onReassignToggle: () => void
  onAssign: (driverId: string) => void
  onDemoAccept: (offerId: string) => void
  onCancel: () => void
}) {
  const t = useT()
  const { trip, data, now } = props
  const rider = data.riders.find((item) => item.id === trip.riderId)
  const driver = data.drivers.find((item) => item.id === trip.driverId)
  const car = data.cars.find((item) => item.id === trip.carId)
  const firm = data.allFirms.find((item) => item.id === trip.firmId)
  const offer = data.offers.find((item) => item.tripId === trip.id && item.status === "pending" && item.driverId === trip.driverId)
  const secondsLeft = offer ? Math.max(0, Math.ceil((Date.parse(offer.expiresAt) - now) / 1000)) : undefined
  const waitingMinutes = Math.max(0, Math.floor((now - Date.parse(trip.createdAt)) / 60_000))
  const needsDriver = trip.status === "requested" || trip.status === "scheduled"
  const showSuggestions = needsDriver || props.reassigning
  const suggestions = showSuggestions ? suggestDrivers(trip, data.drivers, data.cars, data.allFirms, { firmId: props.scopeFirm }) : []

  return (
    <article className="rounded-2xl border bg-card p-4" aria-label={t("ops.dispatch.tripLabel", { id: trip.id })}>
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/ops/trips?id=${trip.id}`} className="font-semibold hover:underline">
          {trip.id}
        </Link>
        <Badge variant="outline">{t(`tripType.${trip.type}` as TranslationKey)}</Badge>
        <StatusBadge status={trip.status} />
        <span className="ml-auto font-semibold tabular-nums">{formatMoney(trip.fare)}</span>
      </div>
      <p className="mt-2 flex items-center gap-2 text-sm">
        <MapPin className="size-4 shrink-0 text-primary" />
        {placeName(trip.pickup)} → {placeName(trip.dropoff)} · {t("common.km", { km: trip.distanceKm })}
      </p>
      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <UserRound className="size-3.5" /> {rider?.name ?? trip.riderId}
        </span>
        <span>{t(`payment.method.${trip.paymentMethod}` as TranslationKey)}</span>
        <span>{firm?.name}</span>
        <span className="flex items-center gap-1">
          <Clock3 className="size-3.5" />
          {trip.scheduledFor ? t("ops.dispatch.pickupAt", { time: formatDate(trip.scheduledFor) }) : t("ops.dispatch.waitingFor", { min: waitingMinutes })}
        </span>
      </p>
      {driver && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-secondary p-3 text-sm">
          <span className="font-semibold">{driver.name}</span>
          <span className="text-muted-foreground">{car?.plate}</span>
          {trip.status === "assigned" && (
            <span className={`ml-auto text-xs font-semibold ${secondsLeft != null && secondsLeft <= 5 ? "text-destructive" : ""}`}>
              {secondsLeft != null ? t("ops.dispatch.offerLeft", { seconds: secondsLeft }) : t("ops.dispatch.noOffer")}
            </span>
          )}
          {trip.status === "driver_arriving" && trip.acceptedAt && <span className="ml-auto text-xs text-muted-foreground">{t("ops.dispatch.acceptedAt", { time: formatTime(trip.acceptedAt) })}</span>}
        </div>
      )}
      {showSuggestions && (
        <div className="mt-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("ops.dispatch.suggested")}</p>
          {suggestions.length ? (
            <ul className="flex flex-col gap-2">
              {suggestions.map((row, index) => (
                <li key={row.driver.id} className="flex items-center gap-3 rounded-xl border p-2 pl-3">
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="block truncate font-medium">
                      {row.driver.name} <span className="text-muted-foreground">· {row.car.plate}</span>
                    </span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Star className="size-3 fill-amber-400 text-amber-400" /> {row.driver.rating.toFixed(1)} · {placeName(row.driver.zone)} · {row.km === 0 ? t("ops.dispatch.atPickup") : t("ops.dispatch.kmAway", { km: row.km })}
                      {row.firm.id !== trip.firmId && <> · {row.firm.name}</>}
                    </span>
                  </span>
                  <Button className="min-h-10 min-w-24" variant={index === 0 ? "default" : "outline"} disabled={!!props.busy} onClick={() => props.onAssign(row.driver.id)}>
                    {props.busy === `${trip.id}-${row.driver.id}` ? t("common.saving") : t(needsDriver ? "ops.dispatch.assign" : "ops.dispatch.reassignTo")}
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl bg-secondary p-3 text-sm text-muted-foreground">{t("ops.dispatch.noDrivers")}</p>
          )}
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {reassignableStatuses.includes(trip.status) && (
          <Button variant="outline" className="min-h-10" disabled={!!props.busy} onClick={props.onReassignToggle} aria-expanded={props.reassigning}>
            {props.reassigning ? t("ops.dispatch.hideReassign") : t("ops.dispatch.reassign")}
          </Button>
        )}
        {props.demo && offer && (
          <Button variant="secondary" className="min-h-10" disabled={!!props.busy} onClick={() => props.onDemoAccept(offer.id)}>
            {t("ops.dispatch.demoAccept")}
          </Button>
        )}
        <Button variant="ghost" className="ml-auto min-h-10 text-destructive" disabled={!!props.busy} onClick={props.onCancel}>
          {t("ops.dispatch.cancel")}
        </Button>
      </div>
    </article>
  )
}
