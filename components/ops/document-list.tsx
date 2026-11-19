"use client"

import { useState } from "react"
import { DocumentBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import { Field, Input, Select, Textarea } from "@/components/ui/input"
import * as api from "@/lib/api"
import { documentStatus } from "@/lib/documents"
import { useT, type TranslationKey } from "@/lib/i18n"
import { daysBetween, kigaliDay } from "@/lib/time"
import type { ComplianceDocument, DocumentType } from "@/lib/types"
import { errorText, useOps } from "./ops-context"

const rejectReasons: TranslationKey[] = ["ops.docs.reasonUnreadable", "ops.docs.reasonWrongDoc", "ops.docs.reasonDate", "ops.docs.reasonOther"]

/**
 * A driver's or car's documents with their status. Platform admins approve or reject a document
 * sent for review; a rejection needs a reason, which the driver sees. Firm admins see the status only.
 */
export function DocumentList({ documents, owner, ownerId }: { documents: ComplianceDocument[]; owner: "driver" | "car"; ownerId: string }) {
  const t = useT()
  const { isPlatform, admin, toast } = useOps()
  const [busy, setBusy] = useState(false)
  const [rejecting, setRejecting] = useState<DocumentType>()
  const today = kigaliDay()

  async function decide(type: DocumentType, decision: "approve" | "reject", reason?: string) {
    setBusy(true)
    try {
      await api.reviewDocument({ adminId: admin?.id ?? "", owner, ownerId, type, decision, reason })
      toast(t(decision === "approve" ? "ops.docs.approved" : "ops.docs.rejectedToast", { doc: t(`doc.${type}` as TranslationKey) }))
      setRejecting(undefined)
    } catch (caught) {
      toast(errorText(caught, t("ops.actionFailed")))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <ul className="divide-y text-sm">
        {documents.map((doc) => {
          const status = documentStatus(doc, today)
          const left = doc.expiryDate ? daysBetween(today, doc.expiryDate) : undefined
          return (
            <li key={doc.id} className="py-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 font-medium">{t(`doc.${doc.type}` as TranslationKey)}</span>
                <span className="text-xs text-muted-foreground">
                  {doc.expiryDate && status !== "missing" ? t("ops.docs.expires", { date: doc.expiryDate }) : doc.review === "on_file" ? t("ops.docs.noExpiry") : ""}
                  {left != null && left >= 0 && status === "expiring_soon" ? ` · ${t("ops.alerts.expiresIn", { days: left })}` : ""}
                </span>
                <DocumentBadge status={status} />
              </div>
              {status === "rejected" && doc.rejectReason && <p className="mt-1 text-xs text-destructive">{t("ops.docs.rejectedBecause", { reason: doc.rejectReason })}</p>}
              {status === "pending_review" &&
                (isPlatform ? (
                  <div className="mt-2 flex flex-wrap justify-end gap-2">
                    <Button size="sm" variant="outline" className="min-h-9" disabled={busy} onClick={() => setRejecting(doc.type)}>
                      {t("ops.docs.reject")}
                    </Button>
                    <Button size="sm" className="min-h-9" disabled={busy} onClick={() => void decide(doc.type, "approve")}>
                      {t("ops.docs.approve")}
                    </Button>
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">{t("ops.docs.waitingReview")}</p>
                ))}
            </li>
          )
        })}
      </ul>
      {rejecting && <RejectDialog docName={t(`doc.${rejecting}` as TranslationKey)} busy={busy} onClose={() => setRejecting(undefined)} onConfirm={(reason) => void decide(rejecting, "reject", reason)} />}
    </>
  )
}

function RejectDialog({ docName, busy, onClose, onConfirm }: { docName: string; busy: boolean; onClose: () => void; onConfirm: (reason: string) => void }) {
  const t = useT()
  const [choice, setChoice] = useState<TranslationKey>(rejectReasons[0])
  const [note, setNote] = useState("")
  const reason = choice === "ops.docs.reasonOther" ? note.trim() : t(choice)
  return (
    <Dialog title={t("ops.docs.rejectTitle", { doc: docName })} description={t("ops.docs.rejectDetail")} onClose={onClose} closeLabel={t("common.close")}>
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          if (reason) onConfirm(reason)
        }}
      >
        <Field id="reject-reason" label={t("ops.docs.reason")}>
          <Select id="reject-reason" value={choice} onChange={(event) => setChoice(event.target.value as TranslationKey)}>
            {rejectReasons.map((key) => (
              <option key={key} value={key}>
                {t(key)}
              </option>
            ))}
          </Select>
        </Field>
        {choice === "ops.docs.reasonOther" && (
          <Field id="reject-note" label={t("ops.docs.reasonOtherLabel")}>
            <Textarea id="reject-note" maxLength={200} value={note} onChange={(event) => setNote(event.target.value)} />
          </Field>
        )}
        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="outline" className="min-h-10" onClick={onClose}>
            {t("ops.form.cancel")}
          </Button>
          <Button type="submit" variant="destructive" className="min-h-10" disabled={busy || !reason}>
            {t("ops.docs.reject")}
          </Button>
        </div>
      </form>
    </Dialog>
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
