"use client"

import { ArrowLeft, Plus, Search, Star } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"
import { StatusBadge } from "@/components/shared/status-badge"
import { TripCard } from "@/components/shared/trip-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import { Field, Input, Select } from "@/components/ui/input"
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table"
import * as api from "@/lib/api"
import { driverDocumentTypes } from "@/lib/documents"
import { formatPhone } from "@/lib/format"
import { useT, type TranslationKey } from "@/lib/i18n"
import { worstDocumentStatus } from "@/lib/ops"
import { placeName, places } from "@/lib/places"
import type { DocumentType, Driver, DriverApproval, PlaceId } from "@/lib/types"
import { DocumentInputs, DocumentList } from "./document-list"
import { errorText, useOps } from "./ops-context"
import { useOpsData, type OpsData } from "./ops-data"
import { Card, Facts, LoadError, Loading, matches, PageHeader } from "./ops-ui"

export function ApprovalBadge({ approval }: { approval: DriverApproval }) {
  const t = useT()
  return <Badge variant={approval === "approved" ? "secondary" : approval === "suspended" ? "destructive" : "outline"}>{t(`ops.approval.${approval}` as TranslationKey)}</Badge>
}

export function DriversScreen() {
  const t = useT()
  const router = useRouter()
  const id = useSearchParams().get("id")
  const { data, error } = useOpsData()
  const [query, setQuery] = useState("")
  const [adding, setAdding] = useState(false)
  if (error && !data) return <LoadError error={error} />
  if (!data) return <Loading />
  if (id) return <DriverDetail driverId={id} data={data} onBack={() => router.push("/ops/drivers")} />
  const rows = data.drivers.filter((driver) => matches(query, driver.name, driver.phone, data.cars.find((car) => car.id === driver.carId)?.plate, data.allFirms.find((firm) => firm.id === driver.firmId)?.name))

  return (
    <>
      <PageHeader
        title={t("ops.drivers.title")}
        detail={t("ops.drivers.detail", { count: data.drivers.length })}
        action={
          <Button className="min-h-10" onClick={() => setAdding(true)} disabled={!data.firms.length}>
            <Plus className="size-4" /> {t("ops.drivers.add")}
          </Button>
        }
      />
      <div className="relative mb-4 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input type="search" aria-label={t("ops.drivers.search")} placeholder={t("ops.drivers.search")} className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>
      <Table>
        <THead>
          <tr>
            <Th>{t("ops.drivers.name")}</Th>
            <Th>{t("ops.drivers.firm")}</Th>
            <Th>{t("ops.drivers.car")}</Th>
            <Th>{t("ops.drivers.presence")}</Th>
            <Th>{t("ops.drivers.approval")}</Th>
            <Th>{t("ops.drivers.documents")}</Th>
            <Th className="text-right">{t("ops.drivers.rating")}</Th>
          </tr>
        </THead>
        <TBody>
          {rows.map((driver) => (
            <Tr key={driver.id}>
              <Td>
                <Link href={`/ops/drivers?id=${driver.id}`} className="font-semibold hover:underline">
                  {driver.name}
                </Link>
                <span className="block text-xs text-muted-foreground">{formatPhone(driver.phone)}</span>
              </Td>
              <Td>{data.allFirms.find((firm) => firm.id === driver.firmId)?.name}</Td>
              <Td>{data.cars.find((car) => car.id === driver.carId)?.plate ?? "—"}</Td>
              <Td>{t(`ops.presence.${driver.status}` as TranslationKey)}</Td>
              <Td>
                <ApprovalBadge approval={driver.approval} />
                {driver.suspendAfterTrip && <span className="mt-1 block text-xs text-amber-700 dark:text-amber-300">{t("ops.drivers.suspendAfterTripShort")}</span>}
              </Td>
              <Td>
                <StatusBadge status={worstDocumentStatus(driver.documents)} />
              </Td>
              <Td className="text-right tabular-nums">{driver.rating.toFixed(1)}</Td>
            </Tr>
          ))}
          {!rows.length && (
            <tr>
              <Td colSpan={7} className="py-8 text-center text-muted-foreground">
                {t("ops.drivers.none")}
              </Td>
            </tr>
          )}
        </TBody>
      </Table>
      {adding && <AddDriverDialog data={data} onClose={() => setAdding(false)} onAdded={(driver) => router.push(`/ops/drivers?id=${driver.id}`)} />}
    </>
  )
}

function DriverDetail({ driverId, data, onBack }: { driverId: string; data: OpsData; onBack: () => void }) {
  const t = useT()
  const router = useRouter()
  const { isPlatform, toast } = useOps()
  const [busy, setBusy] = useState(false)
  const driver = data.drivers.find((item) => item.id === driverId)
  const back = (
    <Button variant="outline" className="min-h-10" onClick={onBack}>
      <ArrowLeft className="size-4" /> {t("ops.drivers.back")}
    </Button>
  )
  if (!driver) return <PageHeader title={t("ops.notFound")} action={back} />
  const car = data.cars.find((item) => item.id === driver.carId)
  const firm = data.allFirms.find((item) => item.id === driver.firmId)
  const trips = data.trips.filter((trip) => trip.driverId === driver.id)
  const completed = trips.filter((trip) => trip.status === "completed")

  async function setApproval(approval: "approved" | "suspended") {
    setBusy(true)
    try {
      const updated = await api.setDriverApproval(driverId, approval)
      toast(t(approval === "approved" ? "ops.drivers.approved" : updated.suspendAfterTrip ? "ops.drivers.suspendQueued" : "ops.drivers.suspended", { name: driver!.name }))
    } catch (caught) {
      toast(errorText(caught, t("ops.actionFailed")))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title={driver.name}
        detail={firm?.name}
        action={
          <div className="flex flex-wrap gap-2">
            {isPlatform && driver.approval !== "approved" && (
              <Button className="min-h-10" disabled={busy} onClick={() => void setApproval("approved")}>
                {t("ops.drivers.approve")}
              </Button>
            )}
            {driver.approval !== "suspended" && !driver.suspendAfterTrip && (
              <Button variant="destructive" className="min-h-10" disabled={busy} onClick={() => void setApproval("suspended")}>
                {t("ops.drivers.suspend")}
              </Button>
            )}
            {back}
          </div>
        }
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title={t("ops.drivers.profile")} action={<ApprovalBadge approval={driver.approval} />}>
          <Facts
            rows={[
              [t("ops.drivers.phone"), formatPhone(driver.phone)],
              [t("ops.drivers.firm"), firm ? <Link key="f" href={`/ops/firms?id=${firm.id}`} className="text-primary hover:underline">{firm.name}</Link> : "—"],
              [t("ops.drivers.car"), car ? <Link key="c" href={`/ops/cars?id=${car.id}`} className="text-primary hover:underline">{`${car.plate} · ${car.make} ${car.model}`}</Link> : "—"],
              [t("ops.drivers.presence"), t(`ops.presence.${driver.status}` as TranslationKey)],
              [t("ops.drivers.zone"), placeName(driver.zone)],
              [
                t("ops.drivers.rating"),
                <span key="r" className="inline-flex items-center gap-1">
                  <Star className="size-3.5 fill-amber-400 text-amber-400" /> {driver.rating.toFixed(1)}
                </span>,
              ],
              [t("ops.drivers.trips"), t("ops.firms.tripsDetail", { total: trips.length, completed: completed.length })],
            ]}
          />
          {driver.suspendAfterTrip && (
            <p role="status" className="mt-3 rounded-xl bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
              {t("ops.drivers.suspendPending")}
            </p>
          )}
          {!isPlatform && <p className="mt-3 text-xs text-muted-foreground">{t("ops.drivers.platformApproves")}</p>}
        </Card>
        <Card title={t("ops.drivers.documents")}>
          <DocumentList documents={driver.documents} owner="driver" ownerId={driver.id} />
        </Card>
        <Card title={t("ops.drivers.recentTrips")} className="lg:col-span-2">
          {trips.length ? (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {trips.slice(0, 6).map((trip) => (
                <TripCard key={trip.id} trip={trip} onClick={() => router.push(`/ops/trips?id=${trip.id}`)} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("ops.drivers.noTrips")}</p>
          )}
        </Card>
      </div>
    </>
  )
}

function AddDriverDialog({ data, onClose, onAdded }: { data: OpsData; onClose: () => void; onAdded: (driver: Driver) => void }) {
  const t = useT()
  const { toast } = useOps()
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ firmId: data.firms[0]?.id ?? "", name: "", phone: "", zone: "city-centre" as PlaceId, carId: "" })
  const [documents, setDocuments] = useState<Partial<Record<DocumentType, string>>>({})
  const set = (key: keyof typeof form) => (event: { target: { value: string } }) => setForm((current) => ({ ...current, [key]: event.target.value, ...(key === "firmId" ? { carId: "" } : {}) }))
  const freeCars = data.cars.filter((car) => car.firmId === form.firmId && !data.drivers.some((driver) => driver.carId === car.id))

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      const driver = await api.addDriver({ ...form, carId: form.carId || undefined, documents })
      toast(t("ops.drivers.added", { name: driver.name }))
      onAdded(driver)
    } catch (caught) {
      toast(errorText(caught, t("ops.actionFailed")))
      setBusy(false)
    }
  }

  return (
    <Dialog title={t("ops.drivers.add")} description={t("ops.drivers.addDetail")} onClose={onClose} closeLabel={t("common.close")} wide>
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={(event) => void submit(event)}>
        <Field id="driver-name" label={t("ops.drivers.name")}>
          <Input id="driver-name" required value={form.name} onChange={set("name")} />
        </Field>
        <Field id="driver-phone" label={t("ops.drivers.phone")} hint={t("ops.drivers.phoneHint")}>
          <Input id="driver-phone" required type="tel" inputMode="tel" value={form.phone} onChange={set("phone")} />
        </Field>
        <Field id="driver-firm" label={t("ops.drivers.firm")}>
          <Select id="driver-firm" value={form.firmId} onChange={set("firmId")} disabled={data.firms.length === 1}>
            {data.firms.map((firm) => (
              <option key={firm.id} value={firm.id}>
                {firm.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="driver-zone" label={t("ops.drivers.zone")}>
          <Select id="driver-zone" value={form.zone} onChange={set("zone")}>
            {places.map((place) => (
              <option key={place.id} value={place.id}>
                {place.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="driver-car" label={t("ops.drivers.car")} hint={t("ops.drivers.carHint")} className="sm:col-span-2">
          <Select id="driver-car" value={form.carId} onChange={set("carId")}>
            <option value="">{t("ops.drivers.noCarYet")}</option>
            {freeCars.map((car) => (
              <option key={car.id} value={car.id}>
                {car.plate} · {car.make} {car.model}
              </option>
            ))}
          </Select>
        </Field>
        <DocumentInputs idPrefix="driver-doc" types={driverDocumentTypes} values={documents} onChange={(type, value) => setDocuments((current) => ({ ...current, [type]: value }))} />
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button type="button" variant="outline" className="min-h-10" onClick={onClose}>
            {t("ops.form.cancel")}
          </Button>
          <Button type="submit" className="min-h-10" disabled={busy}>
            {busy ? t("common.saving") : t("ops.drivers.save")}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
