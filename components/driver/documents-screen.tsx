"use client"

import { Upload } from "lucide-react"
import { useState } from "react"
import { DocumentBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import { Field, Input } from "@/components/ui/input"
import { documentStatus } from "@/lib/documents"
import { useT, type TranslationKey } from "@/lib/i18n"
import type { Car, DocumentType, Driver } from "@/lib/types"

export function DocumentsScreen({ driver, car, busy, onSubmit }: { driver: Driver; car?: Car; busy: boolean; onSubmit: (type: DocumentType, expiryDate: string) => Promise<boolean> }) {
  const t = useT()
  const [open, setOpen] = useState<DocumentType>()
  const [expiry, setExpiry] = useState("")
  const [file, setFile] = useState("")
  return (
    <div className="px-5 pb-8 pt-6">
      <h1 className="text-2xl font-semibold">{t("driver.docs.title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("driver.docs.detail")}</p>
      <ul className="mt-4 flex flex-col gap-2">
        {driver.documents.map((doc) => {
          const status = documentStatus(doc)
          return (
            <li key={doc.id} className="rounded-2xl border bg-card p-4">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 font-semibold">{t(`doc.${doc.type}` as TranslationKey)}</span>
                <DocumentBadge status={status} />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{doc.expiryDate && status !== "missing" ? t("ops.docs.expires", { date: doc.expiryDate }) : status === "missing" ? t("status.missing") : t("ops.docs.noExpiry")}</p>
              {status === "rejected" && doc.rejectReason && (
                <p role="note" className="mt-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
                  {t("driver.docs.rejected", { reason: doc.rejectReason })}
                </p>
              )}
              <Button
                variant="outline"
                className="mt-3 min-h-12 w-full"
                onClick={() => {
                  setOpen(doc.type)
                  setExpiry("")
                  setFile("")
                }}
              >
                <Upload className="size-4" /> {t("driver.docs.upload")}
              </Button>
            </li>
          )
        })}
      </ul>
      {car && (
        <>
          <h2 className="mt-6 font-semibold">{t("driver.docs.car", { plate: car.plate })}</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {car.documents.map((doc) => (
              <li key={doc.id} className="flex items-center gap-2 rounded-2xl border bg-card p-4 text-sm">
                <span className="min-w-0 flex-1 font-medium">{t(`doc.${doc.type}` as TranslationKey)}</span>
                <span className="text-xs text-muted-foreground">{doc.expiryDate}</span>
                <DocumentBadge status={documentStatus(doc)} />
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">{t("driver.docs.carNote")}</p>
        </>
      )}
      {open && (
        <Dialog title={t("driver.docs.uploadTitle", { doc: t(`doc.${open}` as TranslationKey) })} description={t("driver.docs.mockNote")} onClose={() => setOpen(undefined)} closeLabel={t("common.close")}>
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              void onSubmit(open, expiry).then((ok) => ok && setOpen(undefined))
            }}
          >
            <Field id="doc-file" label={t("driver.docs.file")}>
              <Input id="doc-file" type="file" accept="image/*,application/pdf" required onChange={(event) => setFile(event.target.files?.[0]?.name ?? "")} className="py-2" />
            </Field>
            {open !== "national_id" && (
              <Field id="doc-expiry" label={t("driver.docs.expiry")}>
                <Input id="doc-expiry" type="date" required value={expiry} onChange={(event) => setExpiry(event.target.value)} />
              </Field>
            )}
            <Button type="submit" className="min-h-12" disabled={busy || !file}>
              {busy ? t("common.saving") : t("driver.docs.send")}
            </Button>
          </form>
        </Dialog>
      )}
    </div>
  )
}
