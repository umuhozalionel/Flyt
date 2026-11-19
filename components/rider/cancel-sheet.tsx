"use client"

import { X } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useT, type TranslationKey } from "@/lib/i18n"

const reasons: TranslationKey[] = ["rider.cancel.tooLong", "rider.cancel.changedPlans", "rider.cancel.mistake", "rider.cancel.otherRide", "rider.cancel.other"]

/** Ask the rider why they are cancelling, then cancel. */
export function CancelSheet({ busy, onConfirm, onClose }: { busy: boolean; onConfirm: (reason: string) => void; onClose: () => void }) {
  const t = useT()
  const [choice, setChoice] = useState<TranslationKey>()
  const [note, setNote] = useState("")
  const reason = choice === "rider.cancel.other" ? note.trim() : choice ? t(choice) : ""
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <section role="dialog" aria-modal="true" aria-labelledby="cancel-heading" className="w-full max-w-sm rounded-3xl bg-background p-5">
        <div className="flex items-center justify-between">
          <h2 id="cancel-heading" className="text-xl font-semibold">
            {t("rider.cancel.title")}
          </h2>
          <button onClick={onClose} aria-label={t("common.close")} className="grid size-10 place-items-center rounded-full bg-secondary">
            <X className="size-5" />
          </button>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{t("rider.cancel.detail")}</p>
        <div className="mt-4 flex flex-col gap-2" role="radiogroup" aria-label={t("rider.cancel.title")}>
          {reasons.map((key) => (
            <button key={key} role="radio" aria-checked={choice === key} onClick={() => setChoice(key)} className={`min-h-12 rounded-xl border px-4 text-left text-sm ${choice === key ? "border-primary bg-primary/5 font-semibold" : "bg-card"}`}>
              {t(key)}
            </button>
          ))}
        </div>
        {choice === "rider.cancel.other" && (
          <textarea aria-label={t("rider.cancel.otherLabel")} placeholder={t("rider.cancel.otherLabel")} value={note} onChange={(event) => setNote(event.target.value)} className="mt-2 min-h-20 w-full rounded-xl border bg-card p-3 text-sm outline-none" />
        )}
        <Button variant="destructive" disabled={!reason || busy} className="mt-4 min-h-12 w-full" onClick={() => onConfirm(reason)}>
          {t("rider.cancel.confirm")}
        </Button>
        <Button variant="outline" className="mt-2 min-h-12 w-full" onClick={onClose}>
          {t("rider.cancel.keep")}
        </Button>
      </section>
    </div>
  )
}
