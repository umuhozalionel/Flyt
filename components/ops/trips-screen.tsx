"use client"

import { Search } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"
import { StatusBadge } from "@/components/shared/status-badge"
import { Field, Input, Select } from "@/components/ui/input"
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table"
import { formatDate, formatMoney } from "@/lib/format"
import { useT, type TranslationKey } from "@/lib/i18n"
import { tripDay } from "@/lib/ops"
import { placeName } from "@/lib/places"
import type { TripStatus, TripType } from "@/lib/types"
import { useOps } from "./ops-context"
import { useOpsData } from "./ops-data"
import { LoadError, Loading, matches, PageHeader } from "./ops-ui"
import { TripDetail } from "./trip-detail"

const statuses: TripStatus[] = ["requested", "scheduled", "assigned", "driver_arriving", "driver_arrived", "in_progress", "completed", "cancelled_by_rider", "cancelled_by_driver", "no_driver_found"]
const types: TripType[] = ["private", "shared_commute", "hourly", "daily", "airport"]

export function TripsScreen() {
  const t = useT()
  const router = useRouter()
  const id = useSearchParams().get("id")
  const { isPlatform } = useOps()
  const { data, error } = useOpsData()
  const [filters, setFilters] = useState({ day: "", status: "", type: "", firm: "", company: "", query: "" })
  const set = (key: keyof typeof filters) => (event: { target: { value: string } }) => setFilters((current) => ({ ...current, [key]: event.target.value }))

  if (error && !data) return <LoadError error={error} />
  if (!data) return <Loading />
  if (id) return <TripDetail tripId={id} data={data} onBack={() => router.push("/ops/trips")} />

  const rows = data.trips.filter((trip) => {
    const rider = data.riders.find((item) => item.id === trip.riderId)
    const driver = data.drivers.find((item) => item.id === trip.driverId)
    const car = data.cars.find((item) => item.id === trip.carId)
    return (
      (!filters.day || tripDay(trip) === filters.day) &&
      (!filters.status || trip.status === filters.status) &&
      (!filters.type || trip.type === filters.type) &&
      (!filters.firm || trip.firmId === filters.firm) &&
      (!filters.company || trip.companyId === filters.company) &&
      matches(filters.query, trip.id, rider?.name, rider?.phone, driver?.name, car?.plate, trip.receiptNo, placeName(trip.pickup), placeName(trip.dropoff))
    )
  })
  const total = rows.reduce((sum, trip) => sum + trip.fare, 0)

  return (
    <>
      <PageHeader title={t("ops.trips.title")} detail={t("ops.trips.count", { count: rows.length, total: formatMoney(total) })} />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <Field id="trip-search" label={t("ops.trips.search")} className="lg:col-span-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="trip-search" type="search" className="pl-9" placeholder={t("ops.trips.searchHint")} value={filters.query} onChange={set("query")} />
          </div>
        </Field>
        <Field id="trip-day" label={t("ops.trips.date")}>
          <Input id="trip-day" type="date" value={filters.day} onChange={set("day")} />
        </Field>
        <Field id="trip-status" label={t("ops.trips.status")}>
          <Select id="trip-status" value={filters.status} onChange={set("status")}>
            <option value="">{t("ops.all")}</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {t(`status.${status}` as TranslationKey)}
                {status.startsWith("cancelled") ? ` (${t(status === "cancelled_by_rider" ? "ops.trips.byRider" : "ops.trips.byDriver")})` : ""}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="trip-type" label={t("ops.trips.type")}>
          <Select id="trip-type" value={filters.type} onChange={set("type")}>
            <option value="">{t("ops.all")}</option>
            {types.map((type) => (
              <option key={type} value={type}>
                {t(`tripType.${type}` as TranslationKey)}
              </option>
            ))}
          </Select>
        </Field>
        {isPlatform && (
          <Field id="trip-firm" label={t("ops.trips.firm")}>
            <Select id="trip-firm" value={filters.firm} onChange={set("firm")}>
              <option value="">{t("ops.all")}</option>
              {data.firms.map((firm) => (
                <option key={firm.id} value={firm.id}>
                  {firm.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field id="trip-company" label={t("ops.trips.company")}>
          <Select id="trip-company" value={filters.company} onChange={set("company")}>
            <option value="">{t("ops.all")}</option>
            {data.companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Table>
        <THead>
          <tr>
            <Th>{t("ops.trips.trip")}</Th>
            <Th>{t("ops.trips.when")}</Th>
            <Th>{t("ops.trips.route")}</Th>
            <Th>{t("ops.trips.rider")}</Th>
            <Th>{t("ops.trips.driver")}</Th>
            <Th>{t("ops.trips.status")}</Th>
            <Th className="text-right">{t("ops.trips.fare")}</Th>
          </tr>
        </THead>
        <TBody>
          {rows.map((trip) => (
            <Tr key={trip.id} className="cursor-pointer" onClick={() => router.push(`/ops/trips?id=${trip.id}`)}>
              <Td>
                <button className="font-semibold hover:underline" onClick={() => router.push(`/ops/trips?id=${trip.id}`)}>
                  {trip.id}
                </button>
                <span className="block text-xs text-muted-foreground">{t(`tripType.${trip.type}` as TranslationKey)}</span>
              </Td>
              <Td className="whitespace-nowrap">{formatDate(trip.scheduledFor ?? trip.createdAt)}</Td>
              <Td>
                {placeName(trip.pickup)} → {placeName(trip.dropoff)}
              </Td>
              <Td>{data.riders.find((item) => item.id === trip.riderId)?.name}</Td>
              <Td>{data.drivers.find((item) => item.id === trip.driverId)?.name ?? "—"}</Td>
              <Td>
                <StatusBadge status={trip.status} />
              </Td>
              <Td className="text-right font-semibold tabular-nums">{formatMoney(trip.fare)}</Td>
            </Tr>
          ))}
          {!rows.length && (
            <tr>
              <Td colSpan={7} className="py-8 text-center text-muted-foreground">
                {t("ops.trips.none")}
              </Td>
            </tr>
          )}
        </TBody>
      </Table>
    </>
  )
}
