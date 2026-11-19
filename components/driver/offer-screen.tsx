"use client"

import { MapPin, Star, UserRound } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { DriverJob } from "@/lib/api"
import { offerSeconds } from "@/lib/config"
import { kmBetween, pickupMinutes } from "@/lib/eta"
import { formatMoney } from "@/lib/format"
import { useT, type TranslationKey } from "@/lib/i18n"
import { placeName } from "@/lib/places"
import type { Driver } from "@/lib/types"

/** Full-screen job offer with the 20-second countdown. */
export function OfferScreen({ job, driver, secondsLeft, busy, onAccept, onDecline }: { job: DriverJob; driver: Driver; secondsLeft: number; busy: boolean; onAccept: () => void; onDecline: () => void }) {
  const t = useT()
  const { trip, rider } = job
  const km = kmBetween(driver.zone, trip.pickup)
  const hire = trip.type === "hourly" || trip.type === "daily"
  return (
    <div className="fixed inset-0 z-40 flex justify-center bg-background">
      <section role="dialog" aria-modal="true" aria-labelledby="offer-heading" className="flex w-full max-w-[430px] flex-col px-5 pb-6 pt-8">
        <div className="flex items-center justify-between">
          <h1 id="offer-heading" className="text-2xl font-semibold">
            {t("driver.offer.title")}
          </h1>
          <span className={`grid size-16 place-items-center rounded-full border-4 text-2xl font-bold tabular-nums ${secondsLeft <= 5 ? "border-destructive text-destructive" : "border-primary text-primary"}`} aria-label={t("driver.offer.secondsLeft", { seconds: secondsLeft })}>
            {secondsLeft}
          </span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-secondary">
          <div className="h-full bg-primary transition-all duration-1000" style={{ width: `${(secondsLeft / offerSeconds) * 100}%` }} />
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Badge variant="outline">{t(`tripType.${trip.type}` as TranslationKey)}</Badge>
          <span className="ml-auto text-3xl font-bold tabular-nums">{formatMoney(trip.fare)}</span>
        </div>
        <ol className="mt-5 flex flex-col gap-4 rounded-3xl border bg-card p-5 text-lg">
          <li className="flex items-start gap-3">
            <MapPin className="mt-1 size-5 shrink-0 text-primary" />
            <span>
              <span className="block text-xs uppercase text-muted-foreground">{t("driver.offer.pickup")}</span>
              {placeName(trip.pickup)}
              <span className="block text-sm text-muted-foreground">{t("driver.offer.toPickup", { km, min: pickupMinutes(km) })}</span>
            </span>
          </li>
          <li className="flex items-start gap-3">
            <MapPin className="mt-1 size-5 shrink-0" />
            <span>
              <span className="block text-xs uppercase text-muted-foreground">{t("driver.offer.dropoff")}</span>
              {placeName(trip.dropoff)}
              <span className="block text-sm text-muted-foreground">{hire ? t(trip.type === "hourly" ? "rider.detail.hours" : "rider.detail.days", { count: trip.hireQuantity ?? 1 }) : t("common.km", { km: trip.distanceKm })}</span>
            </span>
          </li>
        </ol>
        <p className="mt-4 flex items-center gap-2 text-base">
          <UserRound className="size-5" /> {rider.firstName}
          <span className="ml-2 inline-flex items-center gap-1 text-sm text-muted-foreground">
            <Star className="size-4 fill-amber-400 text-amber-400" /> {rider.rating != null ? rider.rating.toFixed(1) : t("driver.offer.newRider")}
          </span>
          <span className="text-sm text-muted-foreground">· {t(`payment.method.${trip.paymentMethod}` as TranslationKey)}</span>
        </p>
        <div className="mt-auto grid grid-cols-[1fr_1.6fr] gap-3 pt-6">
          <Button variant="outline" className="min-h-16 text-lg" disabled={busy} onClick={onDecline}>
            {t("driver.offer.decline")}
          </Button>
          <Button className="min-h-16 text-lg" disabled={busy || secondsLeft <= 0} onClick={onAccept}>
            {busy ? t("common.saving") : t("driver.offer.accept")}
          </Button>
        </div>
      </section>
    </div>
  )
}
