"use client"

import { ArrowLeft, Plus, Search } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"
import { DocumentBadge } from "@/components/shared/status-badge"
import { TripCard } from "@/components/shared/trip-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import { Field, Input, Select } from "@/components/ui/input"
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table"
import * as api from "@/lib/api"
import { carDocumentTypes, documentStatus } from "@/lib/documents"
import { useT, type TranslationKey } from "@/lib/i18n"
import { placeName, places } from "@/lib/places"
import type { Car, CarAvailability, DocumentType, PlaceId } from "@/lib/types"
import { DocumentInputs, DocumentList } from "./document-list"
import { errorText, useOps } from "./ops-context"
import { useOpsData, type OpsData } from "./ops-data"
import { Card, Facts, LoadError, Loading, matches, PageHeader } from "./ops-ui"

function AvailabilityBadge({ availability }: { availability: CarAvailability }) {
  const t = useT()
  return <Badge variant={availability === "available" ? "secondary" : availability === "out_of_service" ? "destructive" : "outline"}>{t(`ops.availability.${availability}` as TranslationKey)}</Badge>
}

function DocCell({ car, type }: { car: Car; type: DocumentType }) {
  const doc = car.documents.find((item) => item.type === type)
  if (!doc) return <>—</>
  return (
    <span className="flex flex-col items-start gap-1">
      <span className="text-xs tabular-nums">{doc.expiryDate ?? "—"}</span>
      <DocumentBadge status={documentStatus(doc)} />
    </span>
  )
}

export function CarsScreen() {
  const t = useT()
  const router = useRouter()
  const id = useSearchParams().get("id")
  const { data, error } = useOpsData()
  const [query, setQuery] = useState("")
  const [adding, setAdding] = useState(false)
  if (error && !data) return <LoadError error={error} />
  if (!data) return <Loading />
  if (id) return <CarDetail carId={id} data={data} onBack={() => router.push("/ops/cars")} />
  const rows = data.cars.filter((car) => matches(query, car.plate, car.make, car.model, data.allFirms.find((firm) => firm.id === car.firmId)?.name))

  return (
    <>
      <PageHeader
        title={t("ops.cars.title")}
        detail={t("ops.cars.detail", { count: data.cars.length, electric: data.cars.filter((car) => car.power === "electric").length })}
        action={
          <Button className="min-h-10" onClick={() => setAdding(true)} disabled={!data.firms.length}>
            <Plus className="size-4" /> {t("ops.cars.add")}
          </Button>
        }
      />
      <div className="relative mb-4 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input type="search" aria-label={t("ops.cars.search")} placeholder={t("ops.cars.search")} className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>
      <Table>
        <THead>
          <tr>
            <Th>{t("ops.cars.plate")}</Th>
            <Th>{t("ops.cars.car")}</Th>
            <Th>{t("ops.cars.firm")}</Th>
            <Th>{t("ops.cars.power")}</Th>
            <Th>{t("ops.cars.availability")}</Th>
            <Th>{t("doc.inspection")}</Th>
            <Th>{t("doc.insurance")}</Th>
          </tr>
        </THead>
        <TBody>
          {rows.map((car) => (
            <Tr key={car.id}>
              <Td>
                <Link href={`/ops/cars?id=${car.id}`} className="font-semibold hover:underline">
                  {car.plate}
                </Link>
              </Td>
              <Td>
                {car.make} {car.model}
                <span className="block text-xs text-muted-foreground">{t("ops.cars.yearSeats", { year: car.year, seats: car.seats })}</span>
              </Td>
              <Td>{data.allFirms.find((firm) => firm.id === car.firmId)?.name}</Td>
              <Td>{t(`ops.power.${car.power}` as TranslationKey)}</Td>
              <Td>
                <AvailabilityBadge availability={car.availability} />
              </Td>
              <Td>
                <DocCell car={car} type="inspection" />
              </Td>
              <Td>
                <DocCell car={car} type="insurance" />
              </Td>
            </Tr>
          ))}
          {!rows.length && (
            <tr>
              <Td colSpan={7} className="py-8 text-center text-muted-foreground">
                {t("ops.cars.none")}
              </Td>
            </tr>
          )}
        </TBody>
      </Table>
      {adding && <AddCarDialog data={data} onClose={() => setAdding(false)} onAdded={(car) => router.push(`/ops/cars?id=${car.id}`)} />}
    </>
  )
}

function CarDetail({ carId, data, onBack }: { carId: string; data: OpsData; onBack: () => void }) {
  const t = useT()
  const router = useRouter()
  const car = data.cars.find((item) => item.id === carId)
  const back = (
    <Button variant="outline" className="min-h-10" onClick={onBack}>
      <ArrowLeft className="size-4" /> {t("ops.cars.back")}
    </Button>
  )
  if (!car) return <PageHeader title={t("ops.notFound")} action={back} />
  const firm = data.allFirms.find((item) => item.id === car.firmId)
  const driver = data.drivers.find((item) => item.carId === car.id)
  const trips = data.trips.filter((trip) => trip.carId === car.id)
  return (
    <>
      <PageHeader title={car.plate} detail={`${car.colour} ${car.make} ${car.model}`} action={back} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title={t("ops.cars.details")} action={<AvailabilityBadge availability={car.availability} />}>
          <Facts
            rows={[
              [t("ops.cars.plate"), car.plate],
              [t("ops.cars.makeModel"), `${car.make} ${car.model}`],
              [t("ops.cars.colour"), car.colour],
              [t("ops.cars.year"), String(car.year)],
              [t("ops.cars.seats"), String(car.seats)],
              [t("ops.cars.power"), t(`ops.power.${car.power}` as TranslationKey)],
              [t("ops.cars.firm"), firm ? <Link key="f" href={`/ops/firms?id=${firm.id}`} className="text-primary hover:underline">{firm.name}</Link> : "—"],
              [t("ops.cars.driver"), driver ? <Link key="d" href={`/ops/drivers?id=${driver.id}`} className="text-primary hover:underline">{driver.name}</Link> : "—"],
              [t("ops.drivers.zone"), placeName(car.zone)],
            ]}
          />
        </Card>
        <Card title={t("ops.drivers.documents")}>
          <DocumentList documents={car.documents} owner="car" ownerId={car.id} />
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

function AddCarDialog({ data, onClose, onAdded }: { data: OpsData; onClose: () => void; onAdded: (car: Car) => void }) {
  const t = useT()
  const { toast } = useOps()
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ firmId: data.firms[0]?.id ?? "", plate: "", make: "", model: "", colour: "", year: String(new Date().getFullYear()), seats: "4", power: "electric" as Car["power"], zone: "city-centre" as PlaceId })
  const [documents, setDocuments] = useState<Partial<Record<DocumentType, string>>>({})
  const set = (key: keyof typeof form) => (event: { target: { value: string } }) => setForm((current) => ({ ...current, [key]: event.target.value }))

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      const car = await api.addCar({ ...form, year: Number(form.year), seats: Number(form.seats), documents })
      toast(t("ops.cars.added", { plate: car.plate }))
      onAdded(car)
    } catch (caught) {
      toast(errorText(caught, t("ops.actionFailed")))
      setBusy(false)
    }
  }

  return (
    <Dialog title={t("ops.cars.add")} description={t("ops.cars.addDetail")} onClose={onClose} closeLabel={t("common.close")} wide>
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={(event) => void submit(event)}>
        <Field id="car-plate" label={t("ops.cars.plate")} hint={t("ops.cars.plateHint")}>
          <Input id="car-plate" required autoCapitalize="characters" value={form.plate} onChange={set("plate")} />
        </Field>
        <Field id="car-firm" label={t("ops.cars.firm")}>
          <Select id="car-firm" value={form.firmId} onChange={set("firmId")} disabled={data.firms.length === 1}>
            {data.firms.map((firm) => (
              <option key={firm.id} value={firm.id}>
                {firm.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="car-make" label={t("ops.cars.make")}>
          <Input id="car-make" required value={form.make} onChange={set("make")} />
        </Field>
        <Field id="car-model" label={t("ops.cars.model")}>
          <Input id="car-model" required value={form.model} onChange={set("model")} />
        </Field>
        <Field id="car-colour" label={t("ops.cars.colour")}>
          <Input id="car-colour" required value={form.colour} onChange={set("colour")} />
        </Field>
        <Field id="car-power" label={t("ops.cars.power")}>
          <Select id="car-power" value={form.power} onChange={set("power")}>
            <option value="electric">{t("ops.power.electric")}</option>
            <option value="fuel">{t("ops.power.fuel")}</option>
          </Select>
        </Field>
        <Field id="car-year" label={t("ops.cars.year")}>
          <Input id="car-year" required type="number" min={2000} step={1} value={form.year} onChange={set("year")} />
        </Field>
        <Field id="car-seats" label={t("ops.cars.seats")}>
          <Input id="car-seats" required type="number" min={1} max={8} step={1} value={form.seats} onChange={set("seats")} />
        </Field>
        <Field id="car-zone" label={t("ops.drivers.zone")} className="sm:col-span-2">
          <Select id="car-zone" value={form.zone} onChange={set("zone")}>
            {places.map((place) => (
              <option key={place.id} value={place.id}>
                {place.name}
              </option>
            ))}
          </Select>
        </Field>
        <DocumentInputs idPrefix="car-doc" types={carDocumentTypes} values={documents} onChange={(type, value) => setDocuments((current) => ({ ...current, [type]: value }))} />
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button type="button" variant="outline" className="min-h-10" onClick={onClose}>
            {t("ops.form.cancel")}
          </Button>
          <Button type="submit" className="min-h-10" disabled={busy}>
            {busy ? t("common.saving") : t("ops.cars.save")}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
