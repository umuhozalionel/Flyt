"use client"

import { Check, Copy, FileCheck2, Star } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { formatMoney } from "@/lib/format"
import { useT } from "@/lib/i18n"
import type { Company, Rider } from "@/lib/types"
import type { TripAssignment } from "./types"

const ratingTags = ["rider.rate.friendly", "rider.rate.smooth", "rider.rate.onTime"] as const

export function CompleteScreen(props: { assignment: TripAssignment; rider: Rider; company?: Company; onPaid: () => Promise<void>; onRate: (rating: number, tags: string[]) => Promise<void>; onSkip: () => void; toast: (message: string) => void }) {
  const t = useT()
  const { trip, firm } = props.assignment
  const [rating, setRating] = useState(0)
  const [tags, setTags] = useState<string[]>([])
  return (
    <div className="px-5 pb-8 pt-7">
      <div className="mx-auto grid size-16 place-items-center rounded-full bg-primary/10 text-primary">
        <Check className="size-8" />
      </div>
      <h1 className="mt-4 text-center text-2xl font-semibold">{t("rider.complete.arrived")}</h1>
      <p className="mt-1 text-center text-sm text-muted-foreground">{t("rider.complete.thanks", { name: props.rider.name.split(" ")[0] })}</p>
      <div className="mt-6 rounded-2xl border bg-card p-4">
        <div className="flex justify-between text-sm">
          <span>{t("rider.complete.rideFare")}</span>
          <span>{formatMoney(trip.fare)}</span>
        </div>
        <div className="mt-3 flex justify-between border-t pt-3 text-base font-semibold">
          <span>{t("rider.complete.total")}</span>
          <span>{formatMoney(trip.fare)}</span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{t("rider.complete.paidDirect", { firm: firm?.name ?? t("rider.complete.yourFirm") })}</p>
      </div>
      {trip.paymentMethod === "company_account" ? (
        <div className="mt-4 rounded-2xl border bg-secondary p-4">
          <div className="flex items-center gap-2 font-semibold">
            <FileCheck2 className="size-4" /> {t("rider.complete.billedTo", { company: props.company?.name ?? t("rider.complete.yourCompany") })}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{t("rider.complete.onInvoice")}</p>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border bg-card p-4">
          <h2 className="font-semibold">{t("rider.complete.payFirm", { firm: firm?.name ?? t("rider.complete.theFirm") })}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{t("rider.complete.useCode")}</p>
          <div className="mt-3 flex items-center justify-between rounded-xl bg-secondary p-3">
            <span className="text-sm">{t("payment.momo")}</span>
            <span className="font-mono text-sm">{firm?.momoMerchantCode}</span>
            <button aria-label={t("rider.complete.copyMomo")} onClick={() => props.toast(t("rider.complete.momoCopied"))}>
              <Copy className="size-4" />
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between rounded-xl bg-secondary p-3">
            <span className="text-sm">{t("payment.airtel")}</span>
            <span className="font-mono text-sm">{firm?.airtelMerchantCode}</span>
            <button aria-label={t("rider.complete.copyAirtel")} onClick={() => props.toast(t("rider.complete.airtelCopied"))}>
              <Copy className="size-4" />
            </button>
          </div>
          <Button variant="outline" className="mt-3 min-h-11 w-full" onClick={() => void props.onPaid()}>
            {t("rider.complete.iPaid")}
          </Button>
        </div>
      )}
      <div className="mt-6">
        <h2 className="text-center font-semibold">{t("rider.rate.title")}</h2>
        <div className="mt-3 flex justify-center gap-2" role="radiogroup" aria-label={t("rider.rate.label")}>
          {[1, 2, 3, 4, 5].map((value) => (
            <button key={value} onClick={() => setRating(value)} aria-label={t("rider.rate.stars", { count: value })} aria-checked={rating === value} role="radio" className="grid size-11 place-items-center">
              <Star className={`size-7 ${rating >= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {ratingTags.map((key) => {
            const tag = t(key)
            return (
              <button key={key} onClick={() => setTags((current) => (current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]))} className={`min-h-9 rounded-full border px-3 py-1.5 text-xs ${tags.includes(tag) ? "border-primary bg-primary/10" : ""}`}>
                {tag}
              </button>
            )
          })}
        </div>
      </div>
      <Button disabled={!rating} className="mt-5 min-h-14 w-full" onClick={() => void props.onRate(rating, tags)}>
        {t("rider.rate.submit")}
      </Button>
      <button className="mt-3 min-h-11 w-full text-sm text-muted-foreground" onClick={props.onSkip}>
        {t("rider.rate.skip")}
      </button>
    </div>
  )
}
