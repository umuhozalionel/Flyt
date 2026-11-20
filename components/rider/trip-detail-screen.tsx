"use client"

import { BadgeCheck, ReceiptText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MapView } from "@/components/shared/map-view"
import { StatusBadge } from "@/components/shared/status-badge"
import { formatDate, formatMoney, initials } from "@/lib/format"
import { useT, type TranslationKey } from "@/lib/i18n"
import { placeName } from "@/lib/places"
import { activeStatuses } from "@/lib/trip-rules"
import type { Rider, Trip } from "@/lib/types"
import { TripExtras } from "./trip-extras"
import type { TripAssignment } from "./types"

const timeline: { key: keyof Trip; label: TranslationKey }[] = [
  { key: "createdAt", label: "rider.detail.booked" },
  { key: "assignedAt", label: "rider.detail.assigned" },
  { key: "acceptedAt", label: "rider.detail.accepted" },
  { key: "arrivedAt", label: "rider.detail.arrived" },
  { key: "startedAt", label: "rider.detail.started" },
  { key: "completedAt", label: "rider.detail.completed" },
  { key: "cancelledAt", label: "rider.detail.cancelledAt" },
]

export function TripDetailScreen(props: { assignment: TripAssignment; rider?: Rider; toast: (message: string) => void; companyName?: string; onLive: () => void; onReceipt: () => void; onPay: () => void; onCancel: () => void }) {
  const t = useT()
  const { trip, driver, car, firm } = props.assignment
  const live = activeStatuses.includes(trip.status)
  const canCancel = ["requested", "scheduled"].includes(trip.status)
  const unpaid = trip.status === "completed" && trip.paymentMethod !== "company_account" && trip.paymentStatus !== "paid"
  const paymentLabel = trip.paymentMethod === "company_account" ? t("rider.detail.billedTo", { company: props.companyName ?? t("rider.complete.yourCompany") }) : t(trip.paymentMethod === "momo" ? "payment.momo" : "payment.airtel")

  return (
    <div className="px-5 pb-8 pt-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase text-muted-foreground">
            {t(`tripType.${trip.type}` as TranslationKey)} · {trip.id}
          </p>
          <h1 className="mt-1 text-2xl font-semibold">
            {placeName(trip.pickup)} → {placeName(trip.dropoff)}
          </h1>
        </div>
        <StatusBadge status={trip.status} />
      </div>
      <div className="mt-4">
        <MapView pickup={trip.pickup} dropoff={trip.dropoff} />
      </div>
      <dl className="mt-4 divide-y rounded-2xl border bg-card text-sm">
        {trip.scheduledFor && (
          <div className="flex justify-between gap-3 p-3">
            <dt className="text-muted-foreground">{t("rider.detail.pickupTime")}</dt>
            <dd>{formatDate(trip.scheduledFor)}</dd>
          </div>
        )}
        <div className="flex justify-between gap-3 p-3">
          <dt className="text-muted-foreground">{t("rider.detail.distance")}</dt>
          <dd>{trip.hireQuantity ? t(trip.type === "hourly" ? "rider.detail.hours" : "rider.detail.days", { count: trip.hireQuantity }) : t("common.km", { km: trip.distanceKm })}</dd>
        </div>
        <div className="flex justify-between gap-3 p-3">
          <dt className="text-muted-foreground">{t("rider.detail.fare")}</dt>
          <dd className="font-semibold">{formatMoney(trip.fare)}</dd>
        </div>
        <div className="flex justify-between gap-3 p-3">
          <dt className="text-muted-foreground">{t("rider.detail.payment")}</dt>
          <dd className="text-right">
            {paymentLabel} · {t(`payment.status.${trip.paymentStatus}` as TranslationKey)}
          </dd>
        </div>
        {trip.cancelReason && (
          <div className="flex justify-between gap-3 p-3">
            <dt className="text-muted-foreground">{t("rider.detail.reason")}</dt>
            <dd className="text-right">{trip.cancelReason}</dd>
          </div>
        )}
        {trip.riderRating && (
          <div className="flex justify-between gap-3 p-3">
            <dt className="text-muted-foreground">{t("rider.detail.yourRating")}</dt>
            <dd>{"★".repeat(trip.riderRating)}</dd>
          </div>
        )}
      </dl>
      {driver && car && firm && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border bg-card p-4">
          <span className="grid size-11 place-items-center rounded-2xl bg-secondary text-sm font-bold">{initials(driver.name)}</span>
          <span className="min-w-0 flex-1 text-sm">
            <span className="block font-semibold">{driver.name}</span>
            <span className="block text-xs text-muted-foreground">
              {car.colour} {car.make} {car.model} · {car.plate}
            </span>
            <span className="mt-1 flex items-center gap-1 text-xs">
              <BadgeCheck className="size-3.5 text-primary" /> {firm.name} · {t("rider.trip.ruraLicence", { licence: firm.ruraLicenceNo })}
            </span>
          </span>
        </div>
      )}
      <ol className="mt-4 space-y-2 rounded-2xl border bg-card p-4 text-sm" aria-label={t("rider.detail.timeline")}>
        {timeline
          .filter((item) => trip[item.key])
          .map((item) => (
            <li key={item.key} className="flex justify-between gap-3">
              <span className="text-muted-foreground">{t(item.label)}</span>
              <span>{formatDate(String(trip[item.key]))}</span>
            </li>
          ))}
      </ol>
      <div className="mt-5 flex flex-col gap-2">
        {live && (
          <Button className="min-h-12" onClick={props.onLive}>
            {t("rider.detail.openLive")}
          </Button>
        )}
        {unpaid && (
          <Button className="min-h-12" onClick={props.onPay}>
            {t("rider.detail.payNow")}
          </Button>
        )}
        {trip.status === "completed" && (
          <Button variant="outline" className="min-h-12" onClick={props.onReceipt}>
            <ReceiptText className="size-4" /> {t("rider.detail.receipt")}
          </Button>
        )}
        {canCancel && (
          <button onClick={props.onCancel} className="min-h-11 rounded-xl text-sm font-semibold text-destructive">
            {t("rider.trip.cancelRide")}
          </button>
        )}
      </div>
      {props.rider && <TripExtras assignment={props.assignment} rider={props.rider} toast={props.toast} />}
    </div>
  )
}
