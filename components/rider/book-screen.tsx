"use client"

import { CalendarDays, CarFront, Check, ChevronDown, Clock3, Minus, Navigation2, Plus, Users, WifiOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/shared/skeleton"
import { formatMoney } from "@/lib/format"
import { useT, type TranslationKey } from "@/lib/i18n"
import { places } from "@/lib/places"
import type { Company, PaymentMethod, PlaceId, TripType } from "@/lib/types"
import type { BookingDraft } from "./types"

export type OptionQuote = { fare: number; distanceKm: number; rate?: number } | { error: string }

const rideOptions: { type: TripType; label: TranslationKey; detail: TranslationKey; icon: typeof CarFront }[] = [
  { type: "private", label: "rider.book.private", detail: "rider.book.privateDetail", icon: CarFront },
  { type: "shared_commute", label: "rider.book.shared", detail: "rider.book.sharedDetail", icon: Users },
  { type: "airport", label: "rider.book.airport", detail: "rider.book.airportDetail", icon: Navigation2 },
  { type: "hourly", label: "rider.book.hourly", detail: "rider.book.hourlyDetail", icon: Clock3 },
  { type: "daily", label: "rider.book.daily", detail: "rider.book.dailyDetail", icon: CalendarDays },
]

const paymentOptions: { id: PaymentMethod; label: TranslationKey; mark: string }[] = [
  { id: "momo", label: "payment.momo", mark: "M" },
  { id: "airtel", label: "payment.airtelShort", mark: "A" },
  { id: "company_account", label: "payment.companyShort", mark: "▧" },
]

export function BookScreen(props: {
  draft: BookingDraft
  setDraft: (update: Partial<BookingDraft>) => void
  quotes?: Partial<Record<TripType, OptionQuote>>
  /** Minutes until the nearest free car reaches the pickup, per ride type. Missing type: no free car now. */
  etas?: Partial<Record<TripType, number>>
  company?: Company
  routeName?: string
  offline: boolean
  busy: boolean
  onConfirm: () => void
}) {
  const t = useT()
  const { draft, setDraft, quotes, company, busy } = props
  const touchesAirport = draft.pickup === "airport" || draft.dropoff === "airport"
  // Shared commute is only for company staff; airport only when one end is the airport.
  const options = rideOptions.filter((option) => (option.type !== "airport" || touchesAirport) && (option.type !== "shared_commute" || !!company))
  const shared = draft.type === "shared_commute"
  const selected = quotes?.[draft.type]
  const isHire = draft.type === "hourly" || draft.type === "daily"

  const placeSelect = (label: TranslationKey, value: PlaceId, onChange: (value: PlaceId) => void, dot: string, bordered: boolean) => (
    <label className={`flex items-center gap-3 ${bordered ? "border-b pb-3" : "pt-3"}`}>
      <span className={`size-2.5 rounded-full ${dot}`} />
      <span className="w-16 text-xs uppercase text-muted-foreground">{t(label)}</span>
      <select aria-label={t(label)} value={value} onChange={(event) => onChange(event.target.value as PlaceId)} className="min-w-0 flex-1 bg-transparent py-2 text-sm font-medium outline-none">
        {places.map((place) => (
          <option key={place.id} value={place.id}>
            {place.name}
          </option>
        ))}
      </select>
      <ChevronDown className="size-4 text-muted-foreground" />
    </label>
  )

  return (
    <div className="px-5 pb-32 pt-5">
      <h1 className="text-2xl font-semibold">{t("rider.book.title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("rider.book.fixedNote")}</p>
      <div className="mt-5 rounded-2xl border bg-card p-4">
        {placeSelect("rider.book.pickup", draft.pickup, (pickup) => setDraft({ pickup }), "bg-primary", true)}
        {placeSelect("rider.book.dropoff", draft.dropoff, (dropoff) => setDraft({ dropoff }), "bg-foreground", false)}
      </div>
      <div className="mt-6 flex items-center justify-between">
        <h2 className="font-semibold">{t("rider.book.chooseRide")}</h2>
        <span className="text-xs text-muted-foreground">{t("rider.book.carsOnly")}</span>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {!quotes && [0, 1, 2].map((i) => <Skeleton key={i} className="h-[76px]" />)}
        {quotes && options.map(({ type, label, detail, icon: Icon }) => {
          const quote = quotes?.[type]
          return (
            <button
              key={type}
              onClick={() => setDraft({ type })}
              className={`flex min-h-[76px] items-center gap-3 rounded-2xl border p-3 text-left transition ${draft.type === type ? "border-primary bg-primary/5 ring-1 ring-primary" : "bg-card"}`}
            >
              <span className="grid size-11 place-items-center rounded-xl bg-secondary">
                <Icon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{t(label)}</span>
                <span className="block text-xs text-muted-foreground">
                  {t(detail, { rate: quote && "rate" in quote && quote.rate ? formatMoney(quote.rate) : "", company: company?.name ?? "" })} · {!props.etas ? "…" : props.etas[type] != null ? t("rider.book.eta", { min: props.etas[type]! }) : t("rider.book.noCarNow")}
                </span>
              </span>
              <span className="text-right font-bold">{!quote ? "…" : "error" in quote ? <span className="text-xs font-medium text-muted-foreground">{quote.error}</span> : formatMoney(quote.fare)}</span>
              <span className={`grid size-5 place-items-center rounded-full border ${draft.type === type ? "border-primary bg-primary text-primary-foreground" : "border-input"}`}>
                {draft.type === type && <Check className="size-3" />}
              </span>
            </button>
          )
        })}
      </div>
      {shared && <p className="mt-2 text-xs text-muted-foreground">{props.routeName ? t("rider.book.sharedRoute", { route: props.routeName }) : t("rider.book.sharedNoRoute")}</p>}
      {isHire && (
        <div className="mt-3 flex min-h-12 items-center justify-between rounded-xl border bg-card px-4 text-sm">
          <span>{draft.type === "hourly" ? t("rider.book.hours") : t("rider.book.days")}</span>
          <span className="flex items-center gap-3">
            <button className="grid size-10 place-items-center rounded-full bg-secondary disabled:opacity-40" disabled={draft.hireQuantity <= 1} onClick={() => setDraft({ hireQuantity: draft.hireQuantity - 1 })} aria-label={t("rider.book.less")}>
              <Minus className="size-4" />
            </button>
            <span className="w-6 text-center font-semibold" aria-live="polite">
              {draft.hireQuantity}
            </span>
            <button className="grid size-10 place-items-center rounded-full bg-secondary disabled:opacity-40" disabled={draft.hireQuantity >= (draft.type === "hourly" ? 12 : 7)} onClick={() => setDraft({ hireQuantity: draft.hireQuantity + 1 })} aria-label={t("rider.book.more")}>
              <Plus className="size-4" />
            </button>
          </span>
        </div>
      )}
      <button onClick={() => setDraft({ schedule: !draft.schedule })} className="mt-5 flex min-h-12 w-full items-center gap-3 rounded-xl border bg-card px-4 text-sm">
        <CalendarDays className="size-4" />
        <span className="flex-1 text-left">{draft.schedule ? t("rider.book.scheduleThis") : t("rider.book.now")}</span>
        <span className="text-primary">{draft.schedule ? t("rider.book.on") : t("rider.book.schedule")}</span>
      </button>
      {draft.schedule && (
        <input aria-label={t("rider.book.scheduledTime")} type="datetime-local" value={draft.scheduledFor} onChange={(event) => setDraft({ scheduledFor: event.target.value })} className="mt-2 min-h-12 w-full rounded-xl border bg-card px-4 text-sm" />
      )}
      <h2 className="mt-6 font-semibold">{t("rider.book.payWith")}</h2>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {paymentOptions.map((method) => (
          <button
            key={method.id}
            onClick={() => setDraft({ payment: method.id })}
            aria-pressed={(shared ? "company_account" : draft.payment) === method.id}
            disabled={(method.id === "company_account" && !company) || (shared && method.id !== "company_account")}
            className={`min-h-[64px] rounded-xl border px-2 text-xs font-semibold ${(shared ? "company_account" : draft.payment) === method.id ? "border-primary bg-primary/5" : "bg-card"} disabled:cursor-not-allowed disabled:opacity-40`}
          >
            <span className="block">{method.mark}</span>
            {t(method.label)}
          </button>
        ))}
      </div>
      {(shared || draft.payment === "company_account") && company && <p className="mt-2 text-xs text-muted-foreground">{t("rider.book.billedTo", { company: company.name })}</p>}
      <div className="mt-5 rounded-xl bg-secondary px-4 py-3">
        <div className="flex justify-between text-sm">
          <span>{selected && !("error" in selected) ? t("rider.book.estimate", { km: selected.distanceKm }) : t("rider.book.estimateNoKm")}</span>
          <span className="font-bold">{selected && !("error" in selected) ? formatMoney(selected.fare) : "—"}</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{t("rider.book.fixedTax")}</p>
      </div>
      {props.offline && (
        <p role="alert" className="mt-4 flex items-center gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
          <WifiOff className="size-4 shrink-0" /> {t("common.offlineBook")}
        </p>
      )}
      <Button onClick={props.onConfirm} disabled={busy || props.offline || !selected || "error" in selected} className="mt-5 min-h-14 w-full rounded-2xl text-base">
        {busy ? t("rider.book.finding") : selected && !("error" in selected) ? t("rider.book.confirm", { fare: formatMoney(selected.fare) }) : t("rider.book.confirmPlain")}
      </Button>
      <p className="mt-3 text-center text-xs text-muted-foreground">{t("rider.book.payDirect")}</p>
    </div>
  )
}
