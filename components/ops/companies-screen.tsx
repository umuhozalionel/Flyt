"use client"

import { ArrowLeft, Plus } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"
import { TripCard } from "@/components/shared/trip-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import { Field, Input, Select } from "@/components/ui/input"
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table"
import * as api from "@/lib/api"
import { companyMonth, companyStaff, companyTrips } from "@/lib/company"
import { formatMoney, formatPhone } from "@/lib/format"
import { useT, type TranslationKey } from "@/lib/i18n"
import { placeName } from "@/lib/places"
import type { Company, CompanyStatus } from "@/lib/types"
import { errorText, useOps } from "./ops-context"
import { useOpsData, type OpsData } from "./ops-data"
import { InvoiceStatusBadge } from "./invoices-screen"
import { Card, Facts, LoadError, Loading, PageHeader, PlatformOnly } from "./ops-ui"

export function CompanyStatusBadge({ status }: { status: CompanyStatus }) {
  const t = useT()
  return <Badge variant={status === "active" ? "secondary" : "outline"}>{t(`ops.companyStatus.${status}` as TranslationKey)}</Badge>
}

export function CompaniesScreen() {
  const t = useT()
  const router = useRouter()
  const id = useSearchParams().get("id")
  const { isPlatform } = useOps()
  const { data, error } = useOpsData()
  const [adding, setAdding] = useState(false)
  if (!isPlatform) return <PlatformOnly />
  if (error && !data) return <LoadError error={error} />
  if (!data) return <Loading />
  if (id) return <CompanyDetail companyId={id} data={data} onBack={() => router.push("/ops/companies")} />

  return (
    <>
      <PageHeader
        title={t("ops.companies.title")}
        detail={t("ops.companies.detail")}
        action={
          <Button className="min-h-10" onClick={() => setAdding(true)}>
            <Plus className="size-4" /> {t("ops.companies.add")}
          </Button>
        }
      />
      <Table>
        <THead>
          <tr>
            <Th>{t("ops.companies.name")}</Th>
            <Th>{t("ops.companies.contact")}</Th>
            <Th className="text-right">{t("ops.companies.staff")}</Th>
            <Th className="text-right">{t("ops.companies.monthTrips")}</Th>
            <Th className="text-right">{t("ops.companies.monthSpend")}</Th>
            <Th>{t("ops.companies.joinCode")}</Th>
            <Th>{t("ops.companies.status")}</Th>
          </tr>
        </THead>
        <TBody>
          {data.companies.map((company) => {
            const month = companyMonth(data.trips, company.id)
            return (
              <Tr key={company.id}>
                <Td>
                  <Link href={`/ops/companies?id=${company.id}`} className="font-semibold hover:underline">
                    {company.name}
                  </Link>
                </Td>
                <Td>
                  {company.contactName}
                  <span className="block text-xs text-muted-foreground">{formatPhone(company.phone)}</span>
                </Td>
                <Td className="text-right tabular-nums">{t("ops.companies.staffDetail", { onFlyt: companyStaff(data.riders, company.id).length, total: company.staffCount })}</Td>
                <Td className="text-right tabular-nums">{month.trips}</Td>
                <Td className="text-right font-semibold tabular-nums">{formatMoney(month.spend)}</Td>
                <Td className="font-mono text-xs">{company.joinCode}</Td>
                <Td>
                  <CompanyStatusBadge status={company.status} />
                </Td>
              </Tr>
            )
          })}
        </TBody>
      </Table>
      {adding && <AddCompanyDialog onClose={() => setAdding(false)} onAdded={(company) => router.push(`/ops/companies?id=${company.id}`)} />}
    </>
  )
}

function CompanyDetail({ companyId, data, onBack }: { companyId: string; data: OpsData; onBack: () => void }) {
  const t = useT()
  const router = useRouter()
  const company = data.companies.find((item) => item.id === companyId)
  const back = (
    <Button variant="outline" className="min-h-10" onClick={onBack}>
      <ArrowLeft className="size-4" /> {t("ops.companies.back")}
    </Button>
  )
  if (!company) return <PageHeader title={t("ops.notFound")} action={back} />
  const staff = companyStaff(data.riders, company.id)
  const trips = companyTrips(data.trips, company.id)
  const month = companyMonth(data.trips, company.id)
  const invoices = data.companyInvoices.filter((invoice) => invoice.companyId === company.id).sort((a, b) => b.period.localeCompare(a.period))
  const routes = data.routes.filter((route) => route.companyId === company.id)
  return (
    <>
      <PageHeader title={company.name} detail={t("ops.companies.detailHint")} action={back} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title={t("ops.companies.profile")} action={<CompanyStatusBadge status={company.status} />}>
          <Facts
            rows={[
              [t("ops.companies.contact"), company.contactName],
              [t("ops.companies.phone"), formatPhone(company.phone)],
              [t("ops.companies.headcount"), String(company.staffCount)],
              [t("ops.companies.joinCode"), <span key="code" className="font-mono">{company.joinCode}</span>],
              [t("ops.companies.monthTrips"), String(month.trips)],
              [t("ops.companies.monthSpend"), <strong key="spend">{formatMoney(month.spend)}</strong>],
            ]}
          />
        </Card>
        <Card title={t("ops.companies.staffList", { count: staff.length })}>
          {staff.length ? (
            <ul className="divide-y text-sm">
              {staff.map((rider) => (
                <li key={rider.id} className="flex items-center gap-2 py-2">
                  <Link href={`/ops/riders?id=${rider.id}`} className="min-w-0 flex-1 truncate font-medium hover:underline">
                    {rider.name}
                  </Link>
                  <span className="text-muted-foreground">{formatPhone(rider.phone)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{t("ops.companies.noStaff")}</p>
          )}
        </Card>
        <Card title={t("ops.companies.invoices")}>
          {invoices.length ? (
            <ul className="divide-y text-sm">
              {invoices.map((invoice) => (
                <li key={invoice.id} className="flex flex-wrap items-center gap-2 py-2">
                  <span className="min-w-0 flex-1 font-medium">{invoice.period}</span>
                  <span className="text-muted-foreground">{t("ops.invoices.tripCount", { count: invoice.tripCount })}</span>
                  <span className="font-semibold tabular-nums">{formatMoney(invoice.total)}</span>
                  <InvoiceStatusBadge status={invoice.status} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{t("ops.invoices.none")}</p>
          )}
        </Card>
        <Card title={t("ops.companies.routes", { count: routes.length })}>
          {routes.length ? (
            <ul className="divide-y text-sm">
              {routes.map((route) => (
                <li key={route.id} className="py-2">
                  <Link href="/ops/commutes" className="font-medium hover:underline">
                    {route.name}
                  </Link>
                  <span className="block text-xs text-muted-foreground">
                    {route.stops.map(placeName).join(" → ")} · {route.departureTimes.join(", ")} · {t("ops.commutes.ridersCount", { count: route.riderIds.length })}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{t("ops.companies.noRoutes")}</p>
          )}
        </Card>
        <Card title={t("ops.companies.trips", { count: trips.length })} className="lg:col-span-2">
          <p className="mb-3 text-xs text-muted-foreground">{t("ops.companies.tripsNote")}</p>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {trips.length ? trips.slice(0, 20).map((trip) => <TripCard key={trip.id} trip={trip} onClick={() => router.push(`/ops/trips?id=${trip.id}`)} />) : <p className="text-sm text-muted-foreground">{t("ops.drivers.noTrips")}</p>}
          </div>
        </Card>
      </div>
    </>
  )
}

function AddCompanyDialog({ onClose, onAdded }: { onClose: () => void; onAdded: (company: Company) => void }) {
  const t = useT()
  const { toast } = useOps()
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ name: "", contactName: "", phone: "", staffCount: "", status: "active" as CompanyStatus, joinCode: "" })
  const set = (key: keyof typeof form) => (event: { target: { value: string } }) => setForm((current) => ({ ...current, [key]: event.target.value }))

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      const company = await api.addCompany({ name: form.name, contactName: form.contactName, phone: form.phone, staffCount: Number(form.staffCount), status: form.status, joinCode: form.joinCode || undefined })
      toast(t("ops.companies.added", { name: company.name, code: company.joinCode }))
      onAdded(company)
    } catch (caught) {
      toast(errorText(caught, t("ops.actionFailed")))
      setBusy(false)
    }
  }

  return (
    <Dialog title={t("ops.companies.add")} description={t("ops.companies.addDetail")} onClose={onClose} closeLabel={t("common.close")} wide>
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={(event) => void submit(event)}>
        <Field id="co-name" label={t("ops.companies.name")} className="sm:col-span-2">
          <Input id="co-name" required value={form.name} onChange={set("name")} />
        </Field>
        <Field id="co-contact" label={t("ops.companies.contact")}>
          <Input id="co-contact" required value={form.contactName} onChange={set("contactName")} />
        </Field>
        <Field id="co-phone" label={t("ops.companies.phone")}>
          <Input id="co-phone" type="tel" required placeholder="0788 123 456" value={form.phone} onChange={set("phone")} />
        </Field>
        <Field id="co-staff" label={t("ops.companies.headcount")}>
          <Input id="co-staff" type="number" min={1} step={1} required inputMode="numeric" value={form.staffCount} onChange={set("staffCount")} />
        </Field>
        <Field id="co-status" label={t("ops.companies.status")}>
          <Select id="co-status" value={form.status} onChange={set("status")}>
            {(["active", "pending"] as CompanyStatus[]).map((status) => (
              <option key={status} value={status}>
                {t(`ops.companyStatus.${status}` as TranslationKey)}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="co-code" label={t("ops.companies.joinCode")} hint={t("ops.companies.joinCodeHint")} className="sm:col-span-2">
          <Input id="co-code" value={form.joinCode} maxLength={20} onChange={set("joinCode")} />
        </Field>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button type="button" variant="outline" className="min-h-10" onClick={onClose}>
            {t("ops.form.cancel")}
          </Button>
          <Button type="submit" className="min-h-10" disabled={busy}>
            {busy ? t("common.saving") : t("ops.companies.save")}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
