"use client"

import { BadgeCheck, Phone, ShieldAlert, X } from "lucide-react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MapView } from "@/components/shared/map-view"
import { Skeleton } from "@/components/shared/skeleton"
import { demoEmergencyNumber } from "@/lib/config"
import { formatMoney, initials } from "@/lib/format"
import { useT, type TranslationKey } from "@/lib/i18n"
import { driveMinutes, kmBetween, minutesLeft, pickupMinutes } from "@/lib/eta"
import { placeName } from "@/lib/places"
import { useNow } from "@/lib/use-now"
import { useAutoDispatch } from "@/lib/use-demo"
import { TripSteps } from "./trip-steps"
import type { TripAssignment } from "./types"

export function TripScreen(props: {
  assignment: TripAssignment
  busy: boolean
  onArrived: () => void
  onStart: () => void
  onEnd: () => void
  onCancel: () => void
  onSos: () => Promise<void>
  toast: (message: string) => void
}) {
  const t = useT()
  const [showSos, setShowSos] = useState(false)
  // Mock demo only: drive the trip from here when the Dispatch demo toggle is on. Normally the driver app does it.
  const [demo] = useAutoDispatch()
  const { trip, driver, car, firm } = props.assignment
  const waitingForAccept = trip.status === "assigned"
  const canCancel = ["assigned", "driver_arriving", "driver_arrived"].includes(trip.status)

  const now = useNow(15_000)
  // Estimates from the driver's zone and the trip distance (see lib/eta.ts), counting down from when the driver set off.
  const toPickup = driver ? minutesLeft(pickupMinutes(kmBetween(driver.zone, trip.pickup)), trip.acceptedAt, now) : undefined
  const toDropoff = trip.distanceKm > 0 ? minutesLeft(driveMinutes(trip.distanceKm), trip.startedAt, now) : undefined

  const heading =
    trip.status === "driver_arrived"
      ? t("rider.trip.driverHere")
      : trip.status === "in_progress"
        ? toDropoff
          ? t("rider.trip.dropoffIn", { min: toDropoff })
          : t("rider.trip.enjoy")
        : waitingForAccept || toPickup == null
          ? t("rider.trip.waitingAccept")
          : t("rider.trip.arrivingIn", { min: toPickup })

  return (
    <div className="px-5 pb-8 pt-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase text-muted-foreground">{trip.status === "in_progress" ? t("rider.trip.onYourWay") : t("rider.trip.driverOnWay")}</p>
          <h1 className="mt-1 text-2xl font-semibold">{heading}</h1>
        </div>
        <button className="grid size-11 place-items-center rounded-full bg-secondary" onClick={() => setShowSos(true)} aria-label={t("rider.trip.safetyOptions")}>
          <ShieldAlert className="size-5 text-destructive" />
        </button>
      </div>
      <TripSteps status={trip.status} />
      <div className="mt-5">
        <MapView pickup={trip.pickup} dropoff={trip.dropoff} car={!!driver} />
      </div>
      {driver && car && firm ? (
        <div className="mt-4 rounded-2xl border bg-card p-4">
          <div className="flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-2xl bg-secondary text-sm font-bold">{initials(driver.name)}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{driver.name}</span>
              <span className="block text-xs text-muted-foreground">
                ★ {driver.rating.toFixed(1)} · {car.colour} {car.make} {car.model}
              </span>
            </span>
            <a href={`tel:${driver.phone.replace(/\s/g, "")}`} className="grid size-11 place-items-center rounded-full bg-primary text-primary-foreground" aria-label={t("rider.trip.callDriver")}>
              <Phone className="size-5" />
            </a>
          </div>
          <div className="mt-3 rounded-xl bg-secondary p-3">
            <div className="flex items-center justify-between">
              <p className="font-semibold">{car.plate}</p>
              <Badge variant="outline">{t(`tripType.${trip.type}` as TranslationKey)}</Badge>
            </div>
            <div className="mt-2 flex items-start gap-2">
              <BadgeCheck className="mt-0.5 size-4 shrink-0 text-primary" />
              <p className="text-xs leading-5">
                <span className="font-semibold">{firm.name}</span>
                <br />
                <span className="text-muted-foreground">{t("rider.trip.ruraLicence", { licence: firm.ruraLicenceNo })}</span>
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-2" aria-busy>
          <Skeleton className="h-28" />
        </div>
      )}
      <div className="mt-4 rounded-2xl border bg-card p-4">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-primary" />
          <p className="flex-1 text-sm">{placeName(trip.pickup)}</p>
          <span className="text-xs text-muted-foreground">{t("rider.trip.pickup")}</span>
        </div>
        <div className="my-2 ml-1 h-4 border-l border-dashed" />
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-foreground" />
          <p className="flex-1 text-sm">{placeName(trip.dropoff)}</p>
          <span className="text-xs text-muted-foreground">{t("rider.trip.dropoff")}</span>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Button variant="outline" className="min-h-12 flex-1" onClick={() => props.toast(t("rider.trip.shareReady"))}>
          {t("rider.trip.share")}
        </Button>
        <Button variant="outline" className="min-h-12 flex-1" onClick={() => setShowSos(true)}>
          <ShieldAlert className="size-4" /> {t("rider.trip.safety")}
        </Button>
      </div>
      {demo && (
        <div className="mt-5 flex flex-col gap-2">
          {trip.status === "driver_arriving" && (
            <Button onClick={props.onArrived} disabled={props.busy} className="min-h-14">
              {t("rider.trip.demoArrived")}
            </Button>
          )}
          {trip.status === "driver_arrived" && (
            <Button onClick={props.onStart} disabled={props.busy} className="min-h-14">
              {t("rider.trip.demoStart")}
            </Button>
          )}
          {trip.status === "in_progress" && (
            <Button onClick={props.onEnd} disabled={props.busy} className="min-h-14">
              {t("rider.trip.demoEnd")}
            </Button>
          )}
        </div>
      )}
      {canCancel && (
        <button onClick={props.onCancel} className="mt-3 min-h-11 w-full rounded-xl text-sm font-semibold text-destructive">
          {t("rider.trip.cancelRide")}
        </button>
      )}
      <p className="mt-4 text-center text-xs text-muted-foreground">{t("rider.trip.fareTax", { fare: formatMoney(trip.fare) })}</p>
      {showSos && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <section role="dialog" aria-modal="true" aria-labelledby="sos-heading" className="w-full max-w-sm rounded-3xl bg-background p-5">
            <div className="flex items-center justify-between">
              <h2 id="sos-heading" className="text-xl font-semibold">
                {t("rider.sos.title")}
              </h2>
              <button onClick={() => setShowSos(false)} aria-label={t("common.close")} className="grid size-10 place-items-center rounded-full bg-secondary">
                <X className="size-5" />
              </button>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{t("rider.sos.detail")}</p>
            <a href={`tel:${demoEmergencyNumber.replace(/\s/g, "")}`} className="mt-4 flex min-h-12 items-center justify-center gap-2 rounded-xl border font-semibold">
              <Phone className="size-4" /> {t("rider.sos.call", { number: demoEmergencyNumber })}
            </a>
            <Button
              className="mt-2 min-h-12 w-full"
              disabled={props.busy}
              onClick={() => {
                void props.onSos().then(() => setShowSos(false))
              }}
            >
              {t("rider.sos.notify")}
            </Button>
            <p className="mt-3 text-center text-xs text-muted-foreground">{t("rider.sos.demoNote")}</p>
          </section>
        </div>
      )}
    </div>
  )
}
