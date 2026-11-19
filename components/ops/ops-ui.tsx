"use client"

import { useState, type ReactNode } from "react"
import { Skeleton } from "@/components/shared/skeleton"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import { Field, Select, Textarea } from "@/components/ui/input"
import { useT, type TranslationKey } from "@/lib/i18n"

export function PageHeader({ title, detail, action }: { title: string; detail?: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        {detail && <p className="mt-1 text-sm text-muted-foreground">{detail}</p>}
      </div>
      {action}
    </div>
  )
}

export function Card({ title, action, children, className = "" }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border bg-card p-4 ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h3 className="font-semibold">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export function Kpi({ label, value, detail }: { label: string; value: ReactNode; detail?: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
    </div>
  )
}

/** Label and value rows for detail panels. */
export function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-x-4 gap-y-2 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="min-w-0 break-words font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function Loading() {
  return (
    <div className="flex flex-col gap-3" aria-busy>
      <Skeleton className="h-24" />
      <Skeleton className="h-64" />
    </div>
  )
}

export function LoadError({ error }: { error?: Error }) {
  const t = useT()
  return (
    <div role="alert" className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
      {t("ops.loadFailed")} {error?.message}
    </div>
  )
}

const cancelReasons: TranslationKey[] = ["ops.cancel.riderAsked", "ops.cancel.noCars", "ops.cancel.duplicate", "ops.cancel.safety", "ops.cancel.other"]

/** Ops cancels a trip on the rider's behalf, always with a reason. */
export function CancelTripDialog({ tripId, busy, onConfirm, onClose }: { tripId: string; busy: boolean; onConfirm: (reason: string) => void; onClose: () => void }) {
  const t = useT()
  const [choice, setChoice] = useState<TranslationKey>(cancelReasons[0])
  const [note, setNote] = useState("")
  const reason = choice === "ops.cancel.other" ? note.trim() : t(choice)
  return (
    <Dialog title={t("ops.cancel.title", { id: tripId })} description={t("ops.cancel.detail")} onClose={onClose} closeLabel={t("common.close")}>
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          if (reason) onConfirm(reason)
        }}
      >
        <Field id="cancel-reason" label={t("ops.cancel.reason")}>
          <Select id="cancel-reason" value={choice} onChange={(event) => setChoice(event.target.value as TranslationKey)}>
            {cancelReasons.map((key) => (
              <option key={key} value={key}>
                {t(key)}
              </option>
            ))}
          </Select>
        </Field>
        {choice === "ops.cancel.other" && (
          <Field id="cancel-note" label={t("ops.cancel.otherLabel")}>
            <Textarea id="cancel-note" value={note} maxLength={300} onChange={(event) => setNote(event.target.value)} />
          </Field>
        )}
        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="outline" className="min-h-10" onClick={onClose}>
            {t("ops.cancel.keep")}
          </Button>
          <Button type="submit" variant="destructive" className="min-h-10" disabled={busy || !reason}>
            {busy ? t("common.saving") : t("ops.cancel.confirm")}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

/** Shown on screens only platform admins may open, when a firm admin reaches them by link. */
export function PlatformOnly() {
  const t = useT()
  return (
    <div role="alert" className="rounded-2xl border bg-card p-6 text-sm">
      <p className="font-semibold">{t("ops.platformOnly")}</p>
      <p className="mt-1 text-muted-foreground">{t("ops.platformOnlyDetail")}</p>
    </div>
  )
}

/** A filter chip row value for search inputs. */
export const matches = (query: string, ...values: (string | undefined)[]) => {
  const needle = query.trim().toLowerCase()
  return !needle || values.some((value) => value?.toLowerCase().includes(needle))
}
