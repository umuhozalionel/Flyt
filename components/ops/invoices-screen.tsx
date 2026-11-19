"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, Input, Select } from "@/components/ui/input"
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table"
import * as api from "@/lib/api"
import { nextInvoiceStatus } from "@/lib/invoices"
import { formatMoney } from "@/lib/format"
import { useT, type TranslationKey } from "@/lib/i18n"
import { kigaliMonth } from "@/lib/time"
import type { InvoiceStatus } from "@/lib/types"
import { errorText, useOps } from "./ops-context"
import { useOpsData } from "./ops-data"
import { Card, LoadError, Loading, PageHeader } from "./ops-ui"

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const t = useT()
  return <Badge variant={status === "paid" ? "secondary" : status === "sent" ? "outline" : "outline"}>{t(`ops.invoiceStatus.${status}` as TranslationKey)}</Badge>
}

function NextStatusButton({ kind, id, status, busy, onMove }: { kind: "fee" | "company"; id: string; status: InvoiceStatus; busy: boolean; onMove: (kind: "fee" | "company", id: string, next: InvoiceStatus) => void }) {
  const t = useT()
  const next = nextInvoiceStatus[status]
  if (!next) return null
  return (
    <Button size="sm" variant="outline" className="min-h-9" disabled={busy} onClick={() => onMove(kind, id, next)}>
      {t(next === "sent" ? "ops.invoices.markSent" : "ops.invoices.markPaid")}
    </Button>
  )
}

/** Flyt Ltd fee invoices to firms, and monthly invoices to client companies. Totals come from the data source. */
export function InvoicesScreen() {
  const t = useT()
  const { isPlatform, toast } = useOps()
  const { data, error } = useOpsData()
  const [period, setPeriod] = useState("")
  const [runPeriod, setRunPeriod] = useState(kigaliMonth())
  const [busy, setBusy] = useState(false)
  if (error && !data) return <LoadError error={error} />
  if (!data) return <Loading />

  const periods = [...new Set([...data.feeInvoices, ...data.companyInvoices].map((invoice) => invoice.period))].sort().reverse()
  const fees = data.feeInvoices.filter((invoice) => !period || invoice.period === period).sort((a, b) => b.period.localeCompare(a.period))
  const bills = data.companyInvoices.filter((invoice) => !period || invoice.period === period).sort((a, b) => b.period.localeCompare(a.period))
  const firmName = (id: string) => data.allFirms.find((firm) => firm.id === id)?.name ?? id
  const companyName = (id: string) => data.companies.find((company) => company.id === id)?.name ?? id

  async function run(action: () => Promise<string>) {
    setBusy(true)
    try {
      toast(await action())
    } catch (caught) {
      toast(errorText(caught, t("ops.actionFailed")))
    } finally {
      setBusy(false)
    }
  }
  const move = (kind: "fee" | "company", id: string, next: InvoiceStatus) => void run(async () => {
    await api.setInvoiceStatus(kind, id, next)
    return t("ops.invoices.moved", { id, status: t(`ops.invoiceStatus.${next}` as TranslationKey) })
  })

  return (
    <>
      <PageHeader title={t("ops.invoices.title")} detail={isPlatform ? t("ops.invoices.detail") : t("ops.invoices.detailFirm")} />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Field id="invoice-period" label={t("ops.invoices.period")}>
          <Select id="invoice-period" value={period} onChange={(event) => setPeriod(event.target.value)}>
            <option value="">{t("ops.invoices.allPeriods")}</option>
            {periods.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
        </Field>
        {isPlatform && (
          <form
            className="flex flex-wrap items-end gap-2 sm:ml-auto"
            onSubmit={(event) => {
              event.preventDefault()
              void run(async () => {
                const result = await api.generateInvoices(runPeriod)
                return t("ops.invoices.generated", { period: result.period, created: result.created, refreshed: result.refreshed })
              })
            }}
          >
            <Field id="invoice-run" label={t("ops.invoices.runPeriod")}>
              <Input id="invoice-run" type="month" required max={kigaliMonth()} value={runPeriod} onChange={(event) => setRunPeriod(event.target.value)} />
            </Field>
            <Button type="submit" className="min-h-10" disabled={busy}>
              {t("ops.invoices.generate")}
            </Button>
          </form>
        )}
      </div>
      {isPlatform && <p className="mb-4 text-xs text-muted-foreground">{t("ops.invoices.rules")}</p>}
      <div className="grid grid-cols-1 gap-4">
        <Card title={t("ops.invoices.feeTitle")}>
          {fees.length ? (
            <Table>
              <THead>
                <tr>
                  <Th>{t("ops.invoices.number")}</Th>
                  <Th>{t("ops.invoices.period")}</Th>
                  <Th>{t("ops.invoices.firm")}</Th>
                  <Th className="text-right">{t("ops.invoices.trips")}</Th>
                  <Th className="text-right">{t("ops.invoices.fares")}</Th>
                  <Th className="text-right">{t("ops.invoices.fee")}</Th>
                  <Th>{t("ops.invoices.status")}</Th>
                  {isPlatform && <Th>{t("ops.invoices.action")}</Th>}
                </tr>
              </THead>
              <TBody>
                {fees.map((invoice) => (
                  <Tr key={invoice.id}>
                    <Td className="font-mono text-xs">{invoice.id}</Td>
                    <Td>{invoice.period}</Td>
                    <Td>{firmName(invoice.firmId)}</Td>
                    <Td className="text-right tabular-nums">{invoice.tripCount}</Td>
                    <Td className="text-right tabular-nums">{formatMoney(invoice.faresTotal)}</Td>
                    <Td className="text-right font-semibold tabular-nums">{formatMoney(invoice.feeTotal)}</Td>
                    <Td>
                      <InvoiceStatusBadge status={invoice.status} />
                    </Td>
                    {isPlatform && (
                      <Td>
                        <NextStatusButton kind="fee" id={invoice.id} status={invoice.status} busy={busy} onMove={move} />
                      </Td>
                    )}
                  </Tr>
                ))}
              </TBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">{t("ops.invoices.none")}</p>
          )}
        </Card>
        {isPlatform && (
          <Card title={t("ops.invoices.companyTitle")}>
            {bills.length ? (
              <Table>
                <THead>
                  <tr>
                    <Th>{t("ops.invoices.number")}</Th>
                    <Th>{t("ops.invoices.period")}</Th>
                    <Th>{t("ops.invoices.company")}</Th>
                    <Th className="text-right">{t("ops.invoices.trips")}</Th>
                    <Th className="text-right">{t("ops.invoices.total")}</Th>
                    <Th>{t("ops.invoices.status")}</Th>
                    <Th>{t("ops.invoices.action")}</Th>
                  </tr>
                </THead>
                <TBody>
                  {bills.map((invoice) => (
                    <Tr key={invoice.id}>
                      <Td className="font-mono text-xs">{invoice.id}</Td>
                      <Td>{invoice.period}</Td>
                      <Td>{companyName(invoice.companyId)}</Td>
                      <Td className="text-right tabular-nums">{invoice.tripCount}</Td>
                      <Td className="text-right font-semibold tabular-nums">{formatMoney(invoice.total)}</Td>
                      <Td>
                        <InvoiceStatusBadge status={invoice.status} />
                      </Td>
                      <Td>
                        <NextStatusButton kind="company" id={invoice.id} status={invoice.status} busy={busy} onMove={move} />
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">{t("ops.invoices.none")}</p>
            )}
          </Card>
        )}
      </div>
    </>
  )
}
