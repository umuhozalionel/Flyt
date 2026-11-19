"use client"

import { ArrowLeft, Search } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"
import { TripCard } from "@/components/shared/trip-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table"
import { riderForDriver } from "@/lib/driver"
import { formatDay, formatMoney, formatPhone } from "@/lib/format"
import { useT } from "@/lib/i18n"
import type { Rider, Trip } from "@/lib/types"
import { useOps } from "./ops-context"
import { useOpsData, type OpsData } from "./ops-data"
import { Card, Facts, LoadError, Loading, matches, PageHeader, PlatformOnly } from "./ops-ui"

function riderStats(rider: Rider, trips: Trip[]) {
  const own = trips.filter((trip) => trip.riderId === rider.id)
  const done = own.filter((trip) => trip.status === "completed")
  // The rating drivers gave this rider, averaged over completed trips (the same figure drivers see).
  const rating = own[0] ? riderForDriver(own[0], rider, own).rating : undefined
  return { trips: own, completed: done.length, spent: done.reduce((sum, trip) => sum + trip.fare, 0), rating, last: own[0] }
}

export function RidersScreen() {
  const t = useT()
  const router = useRouter()
  const id = useSearchParams().get("id")
  const { isPlatform } = useOps()
  const { data, error } = useOpsData()
  const [query, setQuery] = useState("")
  if (!isPlatform) return <PlatformOnly />
  if (error && !data) return <LoadError error={error} />
  if (!data) return <Loading />
  if (id) return <RiderDetail riderId={id} data={data} onBack={() => router.push("/ops/riders")} />
  const companyName = (companyId?: string) => data.companies.find((company) => company.id === companyId)?.name
  const rows = data.riders.filter((rider) => matches(query, rider.name, rider.phone, companyName(rider.companyId)))

  return (
    <>
      <PageHeader title={t("ops.riders.title")} detail={t("ops.riders.detail", { count: data.riders.length })} />
      <div className="relative mb-4 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input type="search" aria-label={t("ops.riders.search")} placeholder={t("ops.riders.search")} className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>
      <Table>
        <THead>
          <tr>
            <Th>{t("ops.riders.name")}</Th>
            <Th>{t("ops.riders.company")}</Th>
            <Th className="text-right">{t("ops.riders.trips")}</Th>
            <Th className="text-right">{t("ops.riders.rating")}</Th>
            <Th>{t("ops.riders.lastTrip")}</Th>
          </tr>
        </THead>
        <TBody>
          {rows.map((rider) => {
            const stats = riderStats(rider, data.trips)
            return (
              <Tr key={rider.id}>
                <Td>
                  <Link href={`/ops/riders?id=${rider.id}`} className="font-semibold hover:underline">
                    {rider.name}
                  </Link>
                  <span className="block text-xs text-muted-foreground">{formatPhone(rider.phone)}</span>
                </Td>
                <Td>{companyName(rider.companyId) ?? "—"}</Td>
                <Td className="text-right tabular-nums">{t("ops.riders.tripsDetail", { total: stats.trips.length, completed: stats.completed })}</Td>
                <Td className="text-right tabular-nums">{stats.rating != null ? `★ ${stats.rating.toFixed(1)}` : "—"}</Td>
                <Td>{stats.last ? formatDay(stats.last.createdAt) : "—"}</Td>
              </Tr>
            )
          })}
        </TBody>
      </Table>
    </>
  )
}

function RiderDetail({ riderId, data, onBack }: { riderId: string; data: OpsData; onBack: () => void }) {
  const t = useT()
  const router = useRouter()
  const rider = data.riders.find((item) => item.id === riderId)
  const back = (
    <Button variant="outline" className="min-h-10" onClick={onBack}>
      <ArrowLeft className="size-4" /> {t("ops.riders.back")}
    </Button>
  )
  if (!rider) return <PageHeader title={t("ops.notFound")} action={back} />
  const stats = riderStats(rider, data.trips)
  const company = data.companies.find((item) => item.id === rider.companyId)
  return (
    <>
      <PageHeader title={rider.name} detail={formatPhone(rider.phone)} action={back} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Card title={t("ops.riders.profile")}>
          <Facts
            rows={[
              [t("ops.riders.phone"), formatPhone(rider.phone)],
              [t("ops.riders.company"), company ? <Link key="co" href={`/ops/companies?id=${company.id}`} className="hover:underline">{company.name}</Link> : t("ops.riders.noCompany")],
              [t("ops.riders.joined"), formatDay(rider.createdAt)],
              [t("ops.riders.trips"), t("ops.riders.tripsDetail", { total: stats.trips.length, completed: stats.completed })],
              [t("ops.riders.spent"), formatMoney(stats.spent)],
              [t("ops.riders.rating"), stats.rating != null ? t("ops.riders.ratingDetail", { rating: stats.rating.toFixed(1) }) : t("ops.riders.noRating")],
              [t("ops.riders.contacts"), String(rider.emergencyContacts.length)],
            ]}
          />
        </Card>
        <Card title={t("ops.riders.tripList", { count: stats.trips.length })}>
          <div className="flex flex-col gap-2">
            {stats.trips.length ? stats.trips.map((trip) => <TripCard key={trip.id} trip={trip} onClick={() => router.push(`/ops/trips?id=${trip.id}`)} />) : <p className="text-sm text-muted-foreground">{t("ops.drivers.noTrips")}</p>}
          </div>
        </Card>
      </div>
    </>
  )
}
