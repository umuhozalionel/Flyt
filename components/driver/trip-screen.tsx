"use client"

import { Navigation, Phone, ShieldAlert, X } from "lucide-react"
import { useState } from "react"
import { TripSteps } from "@/components/rider/trip-steps"
import { Button } from "@/components/ui/button"
import type { DriverJob } from "@/lib/api"
import { demoEmergencyNumber } from "@/lib/config"
import { directionsUrl } from "@/lib/driver"
import { formatMoney } from "@/lib/format"
import { useT, type TranslationKey } from "@/lib/i18n"
import { placeName, places } from "@/lib/places"

/** The driver's live trip: navigate, arrive, start, end, call the rider, SOS. */
export function DriverTripScreen({ job, busy, onArrived, onStart, onEnd, onSos }: { job: DriverJob; busy: boolean; onArrived: () => void; onStart: () => void; onEnd: () => void; onSos: () => Promise<void> }) {
  const t = useT()
  const [sos, setSos] = useState(false)
  const { trip, rider } = job
  const goingTo = trip.status === "in_progress" ? trip.dropoff : trip.pickup
  const place = places.find((item) => item.id === goingTo)!
  const action =
    trip.status === "driver_arriving"
      ? { label: t("driver.trip.arrived"), run: onArrived }
      : trip.status === "driver_arrived"
        ? { label: t("driver.trip.start"), run: onStart }
        : trip.status === "in_progress"
          ? { label: t("driver.trip.end"), run: onEnd }
          : undefined

  return (
    <div className="px-5 pb-8 pt-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase text-muted-foreground">{t(`tripType.${trip.type}` as TranslationKey)} · {formatMoney(trip.fare)}</p>
          <h1 className="mt-1 text-2xl font-semibold">{trip.status === "in_progress" ? t("driver.trip.toDropoff") : trip.status === "driver_arrived" ? t("driver.trip.waitRider") : t("driver.trip.toPickup")}</h1>
        </div>
        <button className="grid size-12 place-items-center rounded-full bg-destructive/10" onClick={() => setSos(true)} aria-label={t("rider.trip.safetyOptions")}>
          <ShieldAlert className="size-6 text-destructive" />
        </button>
      </div>
      <TripSteps status={trip.status} />
      <div className="mt-5 rounded-3xl border bg-card p-5">
        <p className="text-xs uppercase text-muted-foreground">{trip.status === "in_progress" ? t("driver.offer.dropoff") : t("driver.offer.pickup")}</p>
        <p className="mt-1 text-2xl font-semibold">{placeName(goingTo)}</p>
        <a href={directionsUrl(place)} target="_blank" rel="noreferrer" className="mt-4 flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-secondary text-base font-semibold">
          <Navigation className="size-5" /> {t("driver.trip.navigate")}
        </a>
      </div>
      <div className="mt-4 flex items-center gap-3 rounded-3xl border bg-card p-4">
        <span className="grid size-12 place-items-center rounded-2xl bg-secondary text-lg font-bold">{rider.firstName.slice(0, 1)}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-semibold">{rider.firstName}</span>
          <span className="text-sm text-muted-foreground">{rider.rating != null ? `★ ${rider.rating.toFixed(1)}` : t("driver.offer.newRider")}</span>
        </span>
        {rider.phone && (
          <a href={`tel:${rider.phone.replace(/\s/g, "")}`} className="grid size-14 place-items-center rounded-full bg-primary text-primary-foreground" aria-label={t("driver.trip.callRider", { name: rider.firstName })}>
            <Phone className="size-6" />
          </a>
        )}
      </div>
      {action && (
        <Button className="mt-5 min-h-16 w-full text-lg" disabled={busy} onClick={action.run}>
          {busy ? t("common.saving") : action.label}
        </Button>
      )}
      {sos && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <section role="dialog" aria-modal="true" aria-labelledby="driver-sos" className="w-full max-w-sm rounded-3xl bg-background p-5">
            <div className="flex items-center justify-between">
              <h2 id="driver-sos" className="text-xl font-semibold">
                {t("rider.sos.title")}
              </h2>
              <button onClick={() => setSos(false)} aria-label={t("common.close")} className="grid size-10 place-items-center rounded-full bg-secondary">
                <X className="size-5" />
              </button>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{t("driver.sos.detail")}</p>
            <a href={`tel:${demoEmergencyNumber.replace(/\s/g, "")}`} className="mt-4 flex min-h-14 items-center justify-center gap-2 rounded-xl border font-semibold">
              <Phone className="size-4" /> {t("rider.sos.call", { number: demoEmergencyNumber })}
            </a>
            <Button className="mt-2 min-h-14 w-full" disabled={busy} onClick={() => void onSos().then(() => setSos(false))}>
              {t("rider.sos.notify")}
            </Button>
          </section>
        </div>
      )}
    </div>
  )
}
