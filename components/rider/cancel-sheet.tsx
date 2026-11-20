"use client"

import { X } from "lucide-react"
import { useState } from "react"
import { Drawer } from "vaul"
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
    // A bottom sheet the rider can drag down to close (vaul), like closing it with "Keep my ride".
    <Drawer.Root open onOpenChange={(open) => !open && onClose()}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Drawer.Content aria-describedby={undefined} className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] w-full max-w-[430px] flex-col rounded-t-[28px] bg-background px-5 pb-[max(env(safe-area-inset-bottom),20px)] pt-3 outline-none">
          <div className="mx-auto mb-3 h-1.5 w-11 shrink-0 rounded-full bg-foreground/20" aria-hidden />
          <div className="overflow-y-auto">
            <div className="flex items-center justify-between">
              <Drawer.Title className="text-xl font-semibold">{t("rider.cancel.title")}</Drawer.Title>
              <button onClick={onClose} aria-label={t("common.close")} className="grid size-10 place-items-center rounded-full bg-secondary">
                <X className="size-5" />
              </button>
            </div>
            <Drawer.Description className="mt-1 text-sm text-muted-foreground">{t("rider.cancel.detail")}</Drawer.Description>
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
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
