"use client"

import { DocumentBadge } from "@/components/shared/status-badge"
import { Field, Input } from "@/components/ui/input"
import { documentStatus } from "@/lib/documents"
import { useT, type TranslationKey } from "@/lib/i18n"
import { daysBetween, kigaliDay } from "@/lib/time"
import type { ComplianceDocument, DocumentType } from "@/lib/types"

export function DocumentList({ documents }: { documents: ComplianceDocument[] }) {
  const t = useT()
  const today = kigaliDay()
  return (
    <ul className="divide-y text-sm">
      {documents.map((doc) => {
        const status = documentStatus(doc, today)
        const left = doc.expiryDate ? daysBetween(today, doc.expiryDate) : undefined
        return (
          <li key={doc.id} className="flex flex-wrap items-center gap-2 py-2">
            <span className="min-w-0 flex-1 font-medium">{t(`doc.${doc.type}` as TranslationKey)}</span>
            <span className="text-xs text-muted-foreground">
              {doc.expiryDate && status !== "missing" ? t("ops.docs.expires", { date: doc.expiryDate }) : doc.review === "on_file" ? t("ops.docs.noExpiry") : ""}
              {left != null && left >= 0 && status === "expiring_soon" ? ` · ${t("ops.alerts.expiresIn", { days: left })}` : ""}
            </span>
            <DocumentBadge status={status} />
          </li>
        )
      })}
    </ul>
  )
}

/** Expiry date inputs for a new driver or car. A blank date records the document as missing. */
export function DocumentInputs({ types, values, onChange, idPrefix }: { types: DocumentType[]; values: Partial<Record<DocumentType, string>>; onChange: (type: DocumentType, value: string) => void; idPrefix: string }) {
  const t = useT()
  return (
    <fieldset className="grid gap-3 rounded-2xl border p-3 sm:col-span-2 sm:grid-cols-2">
      <legend className="px-1 text-sm font-semibold">{t("ops.docs.title")}</legend>
      <p className="text-xs text-muted-foreground sm:col-span-2">{t("ops.docs.formHint")}</p>
      {types.map((type) => (
        <Field key={type} id={`${idPrefix}-${type}`} label={type === "national_id" ? t("ops.docs.nationalIdChecked") : t("ops.docs.expiryOf", { doc: t(`doc.${type}` as TranslationKey) })}>
          <Input id={`${idPrefix}-${type}`} type="date" value={values[type] ?? ""} onChange={(event) => onChange(type, event.target.value)} />
        </Field>
      ))}
    </fieldset>
  )
}
