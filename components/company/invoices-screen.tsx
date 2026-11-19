"use client"

import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table"
import { InvoiceStatusBadge } from "@/components/ops/invoices-screen"
import { companyMonth } from "@/lib/company"
import { formatMoney } from "@/lib/format"
import { useT } from "@/lib/i18n"
import { kigaliMonth } from "@/lib/time"
import { useCompanyData } from "./company-data"
import { Card, Facts, LoadError, NoCompany, PageHeader } from "./company-ui"

/** Monthly invoices from Flyt Ltd for company-billed trips. */
export function CompanyInvoices() {
  const t = useT()
  const { data, error } = useCompanyData()
  if (error && !data) return <LoadError error={error} />
  if (!data) return <NoCompany />
  const period = kigaliMonth()
  const invoiced = data.invoices.some((invoice) => invoice.period === period)
  const soFar = companyMonth(data.trips, data.company.id, period)
  const unpaid = data.invoices.filter((invoice) => invoice.status === "sent").reduce((sum, invoice) => sum + invoice.total, 0)
  return (
    <>
      <PageHeader title={t("company.invoices.title")} detail={t("company.invoices.detail")} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Card title={t("company.invoices.summary")}>
          <Facts
            rows={[
              [t("company.invoices.unpaid"), <strong key="unpaid">{formatMoney(unpaid)}</strong>],
              [t("company.invoices.thisMonth", { month: period }), invoiced ? t("company.invoices.alreadyInvoiced") : t("company.invoices.soFar", { trips: soFar.trips, total: formatMoney(soFar.spend) })],
            ]}
          />
          <p className="mt-3 text-xs text-muted-foreground">{t("common.taxNote")}</p>
        </Card>
        <Card title={t("company.invoices.list")}>
          {data.invoices.length ? (
            <Table className="min-w-[480px]">
              <THead>
                <tr>
                  <Th>{t("ops.invoices.number")}</Th>
                  <Th>{t("ops.invoices.period")}</Th>
                  <Th className="text-right">{t("ops.invoices.trips")}</Th>
                  <Th className="text-right">{t("ops.invoices.total")}</Th>
                  <Th>{t("ops.invoices.status")}</Th>
                </tr>
              </THead>
              <TBody>
                {data.invoices.map((invoice) => (
                  <Tr key={invoice.id}>
                    <Td className="font-mono text-xs">{invoice.id}</Td>
                    <Td>{invoice.period}</Td>
                    <Td className="text-right tabular-nums">{invoice.tripCount}</Td>
                    <Td className="text-right font-semibold tabular-nums">{formatMoney(invoice.total)}</Td>
                    <Td>
                      <InvoiceStatusBadge status={invoice.status} />
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">{t("ops.invoices.none")}</p>
          )}
        </Card>
      </div>
    </>
  )
}
