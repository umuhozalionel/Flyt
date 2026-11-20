"use client"

import { Copy, Heart, HeartHandshake, MessageCircle, PackageSearch } from "lucide-react"
import { useState } from "react"
import { ChatPanel } from "@/components/shared/chat-panel"
import { Dialog } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import * as api from "@/lib/api"
import { chatOpen, LOST_ITEM_DAYS, TIP_MAX, tipChoices } from "@/lib/additions"
import { formatDate, formatMoney } from "@/lib/format"
import { useT, type TranslationKey } from "@/lib/i18n"
import type { Rider } from "@/lib/types"
import { useLive } from "@/lib/use-live"
import { useNow } from "@/lib/use-now"
import type { TripAssignment } from "./types"

/**
 * After a completed trip: favourite the driver, tip them by MoMo (when their firm allows it and they opted in),
 * and report a lost item (which reopens chat with the driver for 24 hours).
 */
export function TripExtras({ assignment, rider, toast }: { assignment: TripAssignment; rider: Rider; toast: (message: string) => void }) {
  const t = useT()
  const { trip, driver } = assignment
  const favourites = useLive(() => api.getFavouriteDrivers(rider.id), ["extras"], [rider.id])
  const tip = useLive(() => api.getTipDetails(trip.id), ["extras", "firms", "drivers"], [trip.id])
  const lost = useLive(() => api.getLostItems(), ["extras"])
  const [busy, setBusy] = useState(false)
  const [tipping, setTipping] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [chatting, setChatting] = useState(false)
  const now = useNow(60_000)
  if (trip.status !== "completed" || !driver) return null

  const favourite = (favourites.data ?? []).some((item) => item.driverId === driver.id)
  const items = (lost.data ?? []).filter((item) => item.tripId === trip.id)
  const canReport = !!trip.completedAt && Date.parse(trip.completedAt) > now - LOST_ITEM_DAYS * 86_400_000
  const open = chatOpen(trip, items, now)
  const firstName = driver.name.split(/\s+/)[0]

  async function run(action: () => Promise<unknown>, done: string) {
    setBusy(true)
    try {
      await action()
      toast(done)
      return true
    } catch (error) {
      toast(error instanceof Error ? error.message : t("rider.trip.updateFailed"))
      return false
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mt-5 flex flex-col gap-3" aria-label={t("extras.afterTrip")}>
      <button
        disabled={busy}
        aria-pressed={favourite}
        onClick={() => void run(() => api.setFavouriteDriver(rider.id, driver.id, !favourite), t(favourite ? "extras.favouriteRemoved" : "extras.favouriteAdded", { name: firstName }))}
        className="flex min-h-14 items-center gap-3 rounded-2xl border bg-card px-4 text-left"
      >
        <Heart className={`size-5 ${favourite ? "fill-rose-500 text-rose-500" : "text-muted-foreground"}`} />
        <span className="flex-1">
          <span className="block text-sm font-semibold">{t(favourite ? "extras.favourite" : "extras.addFavourite", { name: firstName })}</span>
          <span className="block text-xs text-muted-foreground">{t("extras.favouriteNote")}</span>
        </span>
      </button>

      {tip.data && (
        <div className="rounded-2xl border bg-card p-4">
          <p className="flex items-center gap-2 font-semibold">
            <HeartHandshake className="size-5 text-primary" /> {t("extras.tipTitle", { name: tip.data.driverFirstName })}
          </p>
          {tip.data.alreadyTipped ? (
            <p className="mt-1 text-sm text-muted-foreground">{t("extras.tipDone")}</p>
          ) : (
            <>
              <p className="mt-1 text-xs text-muted-foreground">{t("extras.tipNote", { until: formatDate(tip.data.until) })}</p>
              <Button variant="outline" className="mt-3 min-h-11 w-full" onClick={() => setTipping(true)}>
                {t("extras.tipButton")}
              </Button>
            </>
          )}
        </div>
      )}

      {canReport && (
        <button onClick={() => setReporting(true)} className="flex min-h-14 items-center gap-3 rounded-2xl border bg-card px-4 text-left">
          <PackageSearch className="size-5 text-muted-foreground" />
          <span className="flex-1">
            <span className="block text-sm font-semibold">{t("extras.lostTitle")}</span>
            <span className="block text-xs text-muted-foreground">{items.length ? t(`extras.lostStatus.${items[0].status}` as TranslationKey) : t("extras.lostNote")}</span>
          </span>
        </button>
      )}
      {open && (
        <Button variant="outline" className="min-h-12" onClick={() => setChatting(true)}>
          <MessageCircle className="size-4" /> {t("extras.chatDriver", { name: firstName })}
        </Button>
      )}

      {tipping && tip.data && <TipDialog tripId={trip.id} momoNumber={tip.data.momoNumber} name={tip.data.driverFirstName} onClose={() => setTipping(false)} toast={toast} />}
      {reporting && (
        <LostItemDialog
          busy={busy}
          onClose={() => setReporting(false)}
          onSend={(description) => void run(() => api.reportLostItem(trip.id, description), t("extras.lostSent")).then((ok) => ok && setReporting(false))}
        />
      )}
      {chatting && <ChatPanel tripId={trip.id} channel="rider_driver" me={{ sender: "rider", senderId: rider.id }} open={open} otherName={firstName} onClose={() => setChatting(false)} toast={toast} />}
    </section>
  )
}

/** Tip by MoMo straight to the driver's own number. The rider confirms before it is recorded; Flyt never holds the money. */
function TipDialog({ tripId, momoNumber, name, onClose, toast }: { tripId: string; momoNumber: string; name: string; onClose: () => void; toast: (message: string) => void }) {
  const t = useT()
  const [amount, setAmount] = useState(1000)
  const [custom, setCustom] = useState("")
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const value = custom ? Number(custom) : amount
  const valid = Number.isInteger(value) && value >= 1 && value <= TIP_MAX

  async function copyNumber() {
    try {
      await navigator.clipboard.writeText(momoNumber.replace(/\s/g, ""))
      toast(t("extras.tipCopied"))
    } catch {
      toast(momoNumber)
    }
  }

  return (
    <Dialog title={t("extras.tipTitle", { name })} description={t("extras.tipDialogNote")} onClose={onClose} closeLabel={t("common.close")}>
      {!confirming ? (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t("extras.tipAmount")}>
            {tipChoices.map((choice) => (
              <button key={choice} role="radio" aria-checked={!custom && amount === choice} onClick={() => (setAmount(choice), setCustom(""))} className={`min-h-12 rounded-xl border text-sm font-semibold ${!custom && amount === choice ? "border-primary bg-primary/10" : ""}`}>
                {formatMoney(choice)}
              </button>
            ))}
          </div>
          <label className="text-sm font-medium" htmlFor="tip-custom">
            {t("extras.tipOther")}
          </label>
          <input id="tip-custom" inputMode="numeric" value={custom} onChange={(event) => setCustom(event.target.value.replace(/\D/g, "").slice(0, 5))} placeholder={t("extras.tipMax", { max: formatMoney(TIP_MAX) })} className="min-h-12 rounded-xl border bg-background px-3" />
          {!valid && <p className="text-sm text-destructive">{t("extras.tipRange", { max: formatMoney(TIP_MAX) })}</p>}
          <Button className="min-h-12" disabled={!valid} onClick={() => setConfirming(true)}>
            {t("extras.tipContinue", { amount: formatMoney(valid ? value : 0) })}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm">{t("extras.tipSendTo", { amount: formatMoney(value), name })}</p>
          <div className="flex items-center justify-between gap-2 rounded-xl bg-secondary p-3">
            <span className="text-sm">{t("payment.momo")}</span>
            <span className="font-mono text-sm">{momoNumber}</span>
            <button className="grid size-10 place-items-center rounded-full hover:bg-background" aria-label={t("extras.tipCopy")} onClick={() => void copyNumber()}>
              <Copy className="size-4" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground">{t("extras.tipFlytNote")}</p>
          <Button
            className="min-h-12"
            disabled={busy}
            onClick={() => {
              setBusy(true)
              api
                .recordTip(tripId, value)
                .then(() => {
                  toast(t("extras.tipThanks"))
                  onClose()
                })
                .catch((error: unknown) => toast(error instanceof Error ? error.message : t("rider.trip.updateFailed")))
                .finally(() => setBusy(false))
            }}
          >
            {t("extras.tipConfirm", { amount: formatMoney(value) })}
          </Button>
          <Button variant="ghost" className="min-h-11" onClick={() => setConfirming(false)}>
            {t("common.back")}
          </Button>
        </div>
      )}
    </Dialog>
  )
}

function LostItemDialog({ busy, onClose, onSend }: { busy: boolean; onClose: () => void; onSend: (description: string) => void }) {
  const t = useT()
  const [text, setText] = useState("")
  return (
    <Dialog title={t("extras.lostTitle")} description={t("extras.lostDialogNote")} onClose={onClose} closeLabel={t("common.close")}>
      <label htmlFor="lost-text" className="text-sm font-medium">
        {t("extras.lostWhat")}
      </label>
      <textarea id="lost-text" value={text} maxLength={500} onChange={(event) => setText(event.target.value)} placeholder={t("extras.lostPlaceholder")} className="mt-2 min-h-24 w-full rounded-xl border bg-background p-3 text-sm" />
      <Button className="mt-3 min-h-12 w-full" disabled={busy || !text.trim()} onClick={() => onSend(text)}>
        {t("extras.lostSend")}
      </Button>
    </Dialog>
  )
}
