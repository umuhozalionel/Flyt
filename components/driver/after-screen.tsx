"use client"

import { Check, Clock3, FileCheck2, Star } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import type { DriverJob } from "@/lib/api"
import { formatMoney } from "@/lib/format"
import { useT } from "@/lib/i18n"
import { placeName } from "@/lib/places"

/** After the trip: payment status, confirm the money arrived, rate the rider. */
export function AfterTripScreen({ job, busy, onConfirm, onRate, onDone }: { job: DriverJob; busy: boolean; onConfirm: (received: boolean) => void; onRate: (rating: number) => void; onDone: () => void }) {
  const t = useT()
  const { trip, rider } = job
  const [rating, setRating] = useState(trip.driverRating ?? 0)
  const company = trip.paymentMethod === "company_account"
  return (
    <div className="px-5 pb-8 pt-7">
      <div className="mx-auto grid size-16 place-items-center rounded-full bg-primary/10 text-primary">
        <Check className="size-8" />
      </div>
      <h1 className="mt-4 text-center text-2xl font-semibold">{t("driver.after.title")}</h1>
      <p className="mt-1 text-center text-sm text-muted-foreground">
        {placeName(trip.pickup)} → {placeName(trip.dropoff)}
      </p>
      <p className="mt-4 text-center text-4xl font-bold tabular-nums">{formatMoney(trip.fare)}</p>
      <div className="mt-5 rounded-3xl border bg-card p-5">
        <h2 className="font-semibold">{t("driver.after.payment")}</h2>
        {company ? (
          <p className="mt-2 flex items-center gap-2 text-base">
            <FileCheck2 className="size-5 text-primary" /> {t("driver.after.billed")}
          </p>
        ) : trip.paymentStatus === "paid" ? (
          <p className="mt-2 flex items-center gap-2 text-base">
            <Check className="size-5 text-primary" /> {t("driver.after.confirmed")}
          </p>
        ) : (
          <>
            <p className="mt-2 flex items-center gap-2 text-base">
              <Clock3 className="size-5" /> {trip.paymentStatus === "failed" ? t("driver.after.notReceivedSaved") : trip.riderPaidAt ? t("driver.after.riderSaysPaid") : t("driver.after.waitingRider")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{t("driver.after.checkMerchant")}</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Button variant="outline" className="min-h-14" disabled={busy} onClick={() => onConfirm(false)}>
                {t("driver.after.notReceived")}
              </Button>
              <Button className="min-h-14" disabled={busy} onClick={() => onConfirm(true)}>
                {t("driver.after.received")}
              </Button>
            </div>
          </>
        )}
      </div>
      <div className="mt-5 rounded-3xl border bg-card p-5">
        <h2 className="font-semibold">{t("driver.after.rate", { name: rider.firstName })}</h2>
        <div className="mt-3 flex justify-center gap-2" role="radiogroup" aria-label={t("driver.after.rateLabel")}>
          {[1, 2, 3, 4, 5].map((value) => (
            <button key={value} role="radio" aria-checked={rating === value} aria-label={t("rider.rate.stars", { count: value })} onClick={() => setRating(value)} className="grid size-12 place-items-center">
              <Star className={`size-8 ${rating >= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
            </button>
          ))}
        </div>
        <Button variant="outline" className="mt-3 min-h-12 w-full" disabled={!rating || busy || trip.driverRating === rating} onClick={() => onRate(rating)}>
          {trip.driverRating === rating ? t("driver.after.rated") : t("driver.after.saveRating")}
        </Button>
      </div>
      <Button className="mt-5 min-h-14 w-full text-base" onClick={onDone}>
        {t("driver.after.done")}
      </Button>
    </div>
  )
}
