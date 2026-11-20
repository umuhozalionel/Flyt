"use client"

import { AlertTriangle, Check, Clock3, Copy, FileCheck2, Star } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { formatMoney } from "@/lib/format"
import { useT } from "@/lib/i18n"
import type { Company, Rider } from "@/lib/types"
import { TripExtras } from "./trip-extras"
import type { TripAssignment } from "./types"

const ratingTags = ["rider.rate.friendly", "rider.rate.smooth", "rider.rate.onTime"] as const

export function CompleteScreen(props: {
  assignment: TripAssignment
  rider: Rider
  company?: Company
  busy: boolean
  onPaid: () => Promise<void>
  onRate: (rating: number, tags: string[], comment: string) => Promise<void>
  onSkip: () => void
  toast: (message: string) => void
}) {
  const t = useT()
  const { trip, firm } = props.assignment
  const [rating, setRating] = useState(trip.riderRating ?? 0)
  const [tags, setTags] = useState<string[]>(trip.ratingTags ?? [])
  const [comment, setComment] = useState(trip.ratingComment ?? "")

  async function copy(code: string | undefined, done: string) {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      props.toast(done)
    } catch {
      props.toast(t("rider.complete.copyFailed", { code }))
    }
  }

  const companyBilled = trip.paymentMethod === "company_account"
  const paid = trip.paymentStatus === "paid"
  const failed = trip.paymentStatus === "failed"
  const waitingConfirm = !paid && !failed && !!trip.riderPaidAt

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
        <p className="mt-2 text-xs text-muted-foreground">{t("common.taxNote")}</p>
      </div>
      {companyBilled ? (
        <div className="mt-4 rounded-2xl border bg-secondary p-4">
          <div className="flex items-center gap-2 font-semibold">
            <FileCheck2 className="size-4" /> {t("rider.complete.billedTo", { company: props.company?.name ?? t("rider.complete.yourCompany") })}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{t("rider.complete.onInvoice")}</p>
        </div>
      ) : paid ? (
        <div className="mt-4 flex items-center gap-2 rounded-2xl border bg-secondary p-4 font-semibold">
          <Check className="size-4 text-primary" /> {t("rider.complete.paidTo", { firm: firm?.name ?? "" })}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border bg-card p-4">
          <h2 className="font-semibold">{t("rider.complete.payFirm", { firm: firm?.name ?? "" })}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{t("rider.complete.useCode")}</p>
          {failed && (
            <div role="alert" className="mt-3 flex items-start gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>{t("rider.complete.failed")}</span>
            </div>
          )}
          <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-secondary p-3">
            <span className="text-sm">{t("payment.momo")}</span>
            <span className="font-mono text-sm">{firm?.momoMerchantCode}</span>
            <button className="grid size-10 place-items-center rounded-full hover:bg-background" aria-label={t("rider.complete.copyMomo")} onClick={() => void copy(firm?.momoMerchantCode, t("rider.complete.momoCopied"))}>
              <Copy className="size-4" />
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-secondary p-3">
            <span className="text-sm">{t("payment.airtel")}</span>
            <span className="font-mono text-sm">{firm?.airtelMerchantCode}</span>
            <button className="grid size-10 place-items-center rounded-full hover:bg-background" aria-label={t("rider.complete.copyAirtel")} onClick={() => void copy(firm?.airtelMerchantCode, t("rider.complete.airtelCopied"))}>
              <Copy className="size-4" />
            </button>
          </div>
          {waitingConfirm ? (
            <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Clock3 className="size-4" /> {t("rider.complete.waitingConfirm", { firm: firm?.name ?? "" })}
            </p>
          ) : (
            <Button variant="outline" className="mt-3 min-h-11 w-full" disabled={props.busy} onClick={() => void props.onPaid()}>
              {props.busy ? t("common.saving") : failed ? t("rider.complete.paidAgain") : t("rider.complete.iPaid")}
            </Button>
          )}
        </div>
      )}
      <TripExtras assignment={props.assignment} rider={props.rider} toast={props.toast} />
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
              <button key={key} aria-pressed={tags.includes(tag)} onClick={() => setTags((current) => (current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]))} className={`min-h-9 rounded-full border px-3 py-1.5 text-xs ${tags.includes(tag) ? "border-primary bg-primary/10" : ""}`}>
                {tag}
              </button>
            )
          })}
        </div>
        <label htmlFor="rating-comment" className="mt-4 block text-sm font-medium">
          {t("rider.rate.comment")}
        </label>
        <textarea id="rating-comment" value={comment} maxLength={500} onChange={(event) => setComment(event.target.value)} placeholder={t("rider.rate.commentPlaceholder")} className="mt-2 min-h-20 w-full rounded-xl border bg-card p-3 text-sm outline-none" />
      </div>
      <Button disabled={!rating || props.busy} className="mt-5 min-h-14 w-full" onClick={() => void props.onRate(rating, tags, comment)}>
        {t("rider.rate.submit")}
      </Button>
      <button className="mt-3 min-h-11 w-full text-sm text-muted-foreground" onClick={props.onSkip}>
        {t("rider.rate.skip")}
      </button>
    </div>
  )
}
