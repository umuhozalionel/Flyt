"use client"

import { ArrowLeft, Plus } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"
import { StatusBadge } from "@/components/shared/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import { Field, Input, Select } from "@/components/ui/input"
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table"
import * as api from "@/lib/api"
import { defaultPlatformFee, platformFeeChoices } from "@/lib/config"
import { EXPIRY_WARNING_DAYS } from "@/lib/documents"
import { formatMoney } from "@/lib/format"
import { useT, type TranslationKey } from "@/lib/i18n"
import { feesOwed, worstDocumentStatus } from "@/lib/ops"
import { daysBetween, kigaliDay } from "@/lib/time"
import type { Firm, FirmStatus, FirmType, PlatformFeePercent } from "@/lib/types"
import { errorText, useOps } from "./ops-context"
import { useOpsData, type OpsData } from "./ops-data"
import { Card, Facts, LoadError, Loading, PageHeader } from "./ops-ui"

function LicenceExpiry({ day }: { day: string }) {
  const t = useT()
  const left = daysBetween(kigaliDay(), day)
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {day}
      {left < 0 ? <Badge variant="destructive">{t("status.expired")}</Badge> : left <= EXPIRY_WARNING_DAYS ? <Badge variant="outline">{t("ops.alerts.expiresIn", { days: left })}</Badge> : null}
    </span>
  )
}

export function FirmsScreen() {
  const t = useT()
  const router = useRouter()
  const id = useSearchParams().get("id")
  const { isPlatform } = useOps()
  const { data, error } = useOpsData()
  const [adding, setAdding] = useState(false)
  if (error && !data) return <LoadError error={error} />
  if (!data) return <Loading />
  if (id) return <FirmDetail firmId={id} data={data} onBack={() => router.push("/ops/firms")} />

  return (
    <>
      <PageHeader
        title={t("ops.firms.title")}
        detail={t("ops.firms.detail")}
        action={
          isPlatform && (
            <Button className="min-h-10" onClick={() => setAdding(true)}>
              <Plus className="size-4" /> {t("ops.firms.add")}
            </Button>
          )
        }
      />
      <Table>
        <THead>
          <tr>
            <Th>{t("ops.firms.name")}</Th>
            <Th>{t("ops.firms.licence")}</Th>
            <Th>{t("ops.firms.expiry")}</Th>
            <Th>{t("ops.firms.status")}</Th>
            <Th className="text-right">{t("ops.firms.fee")}</Th>
            <Th className="text-right">{t("ops.firms.fleet")}</Th>
            <Th className="text-right">{t("ops.firms.owed")}</Th>
          </tr>
        </THead>
        <TBody>
          {data.firms.map((firm) => (
            <Tr key={firm.id}>
              <Td>
                <Link href={`/ops/firms?id=${firm.id}`} className="font-semibold hover:underline">
                  {firm.name}
                </Link>
                <span className="block text-xs text-muted-foreground">{t(`ops.firmType.${firm.type}` as TranslationKey)}</span>
              </Td>
              <Td>{firm.ruraLicenceNo}</Td>
              <Td>
                <LicenceExpiry day={firm.licenceExpiry} />
              </Td>
              <Td>
                <FirmStatusBadge status={firm.status} />
              </Td>
              <Td className="text-right tabular-nums">{firm.feePercent}%</Td>
              <Td className="text-right tabular-nums">{t("ops.firms.fleetCount", { cars: data.cars.filter((car) => car.firmId === firm.id).length, drivers: data.drivers.filter((driver) => driver.firmId === firm.id).length })}</Td>
              <Td className="text-right font-semibold tabular-nums">{formatMoney(feesOwed(firm, data.trips, data.feeInvoices).total)}</Td>
            </Tr>
          ))}
        </TBody>
      </Table>
      {adding && <AddFirmDialog onClose={() => setAdding(false)} onAdded={(firm) => router.push(`/ops/firms?id=${firm.id}`)} />}
    </>
  )
}

export function FirmStatusBadge({ status }: { status: FirmStatus }) {
  const t = useT()
  return <Badge variant={status === "active" ? "secondary" : status === "suspended" ? "destructive" : "outline"}>{t(`ops.firmStatus.${status}` as TranslationKey)}</Badge>
}

function FirmDetail({ firmId, data, onBack }: { firmId: string; data: OpsData; onBack: () => void }) {
  const t = useT()
  const firm = data.firms.find((item) => item.id === firmId)
  const back = (
    <Button variant="outline" className="min-h-10" onClick={onBack}>
      <ArrowLeft className="size-4" /> {t("ops.firms.back")}
    </Button>
  )
  if (!firm) return <PageHeader title={t("ops.notFound")} action={back} />
  const cars = data.cars.filter((car) => car.firmId === firm.id)
  const drivers = data.drivers.filter((driver) => driver.firmId === firm.id)
  const trips = data.trips.filter((trip) => trip.firmId === firm.id)
  const completed = trips.filter((trip) => trip.status === "completed")
  const owed = feesOwed(firm, data.trips, data.feeInvoices)
  return (
    <>
      <PageHeader title={firm.name} detail={t(`ops.firmType.${firm.type}` as TranslationKey)} action={back} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title={t("ops.firms.licenceCard")} action={<FirmStatusBadge status={firm.status} />}>
          <Facts
            rows={[
              [t("ops.firms.licence"), firm.ruraLicenceNo],
              [t("ops.firms.expiry"), <LicenceExpiry key="exp" day={firm.licenceExpiry} />],
              [t("ops.firms.tin"), firm.tin],
              [t("payment.momo"), <span key="momo" className="font-mono">{firm.momoMerchantCode}</span>],
              [t("payment.airtel"), <span key="airtel" className="font-mono">{firm.airtelMerchantCode}</span>],
              [t("ops.firms.fee"), t("ops.firms.feeDetail", { percent: firm.feePercent })],
              [t("ops.firms.hourly"), firm.hourlyRate != null ? formatMoney(firm.hourlyRate) : t("ops.firms.noRate")],
              [t("ops.firms.daily"), firm.dailyRate != null ? formatMoney(firm.dailyRate) : t("ops.firms.noRate")],
            ]}
          />
        </Card>
        <Card title={t("ops.firms.money")}>
          <Facts
            rows={[
              [t("ops.firms.trips"), t("ops.firms.tripsDetail", { total: trips.length, completed: completed.length })],
              [t("ops.firms.fares"), formatMoney(completed.reduce((sum, trip) => sum + trip.fare, 0))],
              [t("ops.firms.feesInvoiced"), formatMoney(owed.invoiced)],
              [t("ops.firms.feesThisMonth"), formatMoney(owed.thisMonth)],
              [t("ops.firms.owed"), <strong key="owed">{formatMoney(owed.total)}</strong>],
            ]}
          />
        </Card>
        <Card title={t("ops.firms.cars", { count: cars.length })}>
          {cars.length ? (
            <ul className="divide-y text-sm">
              {cars.map((car) => (
                <li key={car.id} className="flex items-center gap-2 py-2">
                  <Link href={`/ops/cars?id=${car.id}`} className="font-medium hover:underline">
                    {car.plate}
                  </Link>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">
                    {car.make} {car.model}
                  </span>
                  <StatusBadge status={worstDocumentStatus(car.documents)} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{t("ops.firms.noCars")}</p>
          )}
        </Card>
        <Card title={t("ops.firms.drivers", { count: drivers.length })}>
          {drivers.length ? (
            <ul className="divide-y text-sm">
              {drivers.map((driver) => (
                <li key={driver.id} className="flex items-center gap-2 py-2">
                  <Link href={`/ops/drivers?id=${driver.id}`} className="font-medium hover:underline">
                    {driver.name}
                  </Link>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">{t(`ops.presence.${driver.status}` as TranslationKey)}</span>
                  <StatusBadge status={worstDocumentStatus(driver.documents)} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{t("ops.firms.noDrivers")}</p>
          )}
        </Card>
      </div>
    </>
  )
}

const optionalRwf = (value: string) => (value.trim() ? Number(value) : undefined)

function AddFirmDialog({ onClose, onAdded }: { onClose: () => void; onAdded: (firm: Firm) => void }) {
  const t = useT()
  const { toast } = useOps()
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ name: "", type: "taxi" as FirmType, ruraLicenceNo: "", licenceExpiry: "", tin: "", momoMerchantCode: "", airtelMerchantCode: "", feePercent: String(defaultPlatformFee), hourlyRate: "", dailyRate: "", status: "pending_licence" as FirmStatus })
  const set = (key: keyof typeof form) => (event: { target: { value: string } }) => setForm((current) => ({ ...current, [key]: event.target.value }))

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      const firm = await api.addFirm({
        name: form.name,
        type: form.type,
        ruraLicenceNo: form.ruraLicenceNo,
        licenceExpiry: form.licenceExpiry,
        tin: form.tin,
        momoMerchantCode: form.momoMerchantCode,
        airtelMerchantCode: form.airtelMerchantCode,
        feePercent: Number(form.feePercent) as PlatformFeePercent,
        hourlyRate: optionalRwf(form.hourlyRate),
        dailyRate: optionalRwf(form.dailyRate),
        status: form.status,
      })
      toast(t("ops.firms.added", { name: firm.name }))
      onAdded(firm)
    } catch (caught) {
      toast(errorText(caught, t("ops.actionFailed")))
      setBusy(false)
    }
  }

  return (
    <Dialog title={t("ops.firms.add")} description={t("ops.firms.addDetail")} onClose={onClose} closeLabel={t("common.close")} wide>
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={(event) => void submit(event)}>
        <Field id="firm-name" label={t("ops.firms.name")} className="sm:col-span-2">
          <Input id="firm-name" required value={form.name} onChange={set("name")} />
        </Field>
        <Field id="firm-type" label={t("ops.firms.type")}>
          <Select id="firm-type" value={form.type} onChange={set("type")}>
            <option value="taxi">{t("ops.firmType.taxi")}</option>
            <option value="rental">{t("ops.firmType.rental")}</option>
          </Select>
        </Field>
        <Field id="firm-status" label={t("ops.firms.status")}>
          <Select id="firm-status" value={form.status} onChange={set("status")}>
            {(["pending_licence", "active"] as FirmStatus[]).map((status) => (
              <option key={status} value={status}>
                {t(`ops.firmStatus.${status}` as TranslationKey)}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="firm-licence" label={t("ops.firms.licence")}>
          <Input id="firm-licence" required placeholder="RURA/TX/2026/0000" value={form.ruraLicenceNo} onChange={set("ruraLicenceNo")} />
        </Field>
        <Field id="firm-expiry" label={t("ops.firms.expiry")}>
          <Input id="firm-expiry" type="date" required value={form.licenceExpiry} onChange={set("licenceExpiry")} />
        </Field>
        <Field id="firm-tin" label={t("ops.firms.tin")} hint={t("ops.firms.tinHint")}>
          <Input id="firm-tin" required inputMode="numeric" value={form.tin} onChange={set("tin")} />
        </Field>
        <Field id="firm-fee" label={t("ops.firms.fee")}>
          <Select id="firm-fee" value={form.feePercent} onChange={set("feePercent")}>
            {platformFeeChoices.map((fee) => (
              <option key={fee} value={fee}>
                {fee}%
              </option>
            ))}
          </Select>
        </Field>
        <Field id="firm-momo" label={t("ops.firms.momoCode")}>
          <Input id="firm-momo" required value={form.momoMerchantCode} onChange={set("momoMerchantCode")} />
        </Field>
        <Field id="firm-airtel" label={t("ops.firms.airtelCode")}>
          <Input id="firm-airtel" required value={form.airtelMerchantCode} onChange={set("airtelMerchantCode")} />
        </Field>
        <Field id="firm-hourly" label={t("ops.firms.hourly")} hint={t("ops.firms.rateHint")}>
          <Input id="firm-hourly" type="number" min={1} step={1} inputMode="numeric" value={form.hourlyRate} onChange={set("hourlyRate")} />
        </Field>
        <Field id="firm-daily" label={t("ops.firms.daily")} hint={t("ops.firms.rateHint")}>
          <Input id="firm-daily" type="number" min={1} step={1} inputMode="numeric" value={form.dailyRate} onChange={set("dailyRate")} />
        </Field>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button type="button" variant="outline" className="min-h-10" onClick={onClose}>
            {t("ops.form.cancel")}
          </Button>
          <Button type="submit" className="min-h-10" disabled={busy}>
            {busy ? t("common.saving") : t("ops.firms.save")}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
