"use client"

import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table"
import { commuteRuns } from "@/lib/commute"
import { formatDay } from "@/lib/format"
import { useT } from "@/lib/i18n"
import { placeName } from "@/lib/places"
import type { CommuteRoute, Rider, Trip } from "@/lib/types"
import { useOps } from "./ops-context"
import { useOpsData } from "./ops-data"
import { Card, LoadError, Loading, PageHeader, PlatformOnly } from "./ops-ui"

/** One commute route: stops, times, who rides it, and seats filled on each run. Shared with the company portal. */
export function RouteCard({ route, riders, trips, companyName, riderHref }: { route: CommuteRoute; riders: Rider[]; trips: Trip[]; companyName?: string; riderHref?: (id: string) => string }) {
  const t = useT()
  const runs = commuteRuns(route, trips)
  const members = route.riderIds.map((id) => riders.find((rider) => rider.id === id)).filter((rider): rider is Rider => !!rider)
  return (
    <Card title={route.name} action={companyName && <Badge variant="outline">{companyName}</Badge>}>
      <ol className="flex flex-wrap items-center gap-2 text-sm" aria-label={t("ops.commutes.stops")}>
        {route.stops.map((stop, i) => (
          <li key={stop} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden className="text-muted-foreground">→</span>}
            <span className="rounded-full bg-secondary px-3 py-1 font-medium">{placeName(stop)}</span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-sm text-muted-foreground">{t("ops.commutes.times", { times: route.departureTimes.join(", "), seats: route.seatsPerCar })}</p>
      <h4 className="mt-4 text-sm font-semibold">{t("ops.commutes.ridersCount", { count: members.length })}</h4>
      {members.length ? (
        <ul className="mt-1 flex flex-wrap gap-2 text-sm">
          {members.map((rider) => (
            <li key={rider.id} className="rounded-full border px-3 py-1">
              {riderHref ? (
                <Link href={riderHref(rider.id)} className="hover:underline">
                  {rider.name}
                </Link>
              ) : (
                rider.name
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">{t("ops.commutes.noRiders")}</p>
      )}
      <h4 className="mt-4 text-sm font-semibold">{t("ops.commutes.runs")}</h4>
      {runs.length ? (
        <Table className="min-w-0">
          <THead>
            <tr>
              <Th>{t("ops.commutes.day")}</Th>
              <Th>{t("ops.commutes.departure")}</Th>
              <Th className="text-right">{t("ops.commutes.seatsFilled")}</Th>
            </tr>
          </THead>
          <TBody>
            {runs.map((run) => (
              <Tr key={`${run.day}-${run.departure}`}>
                <Td>{formatDay(`${run.day}T10:00:00Z`)}</Td>
                <Td className="tabular-nums">{run.departure}</Td>
                <Td className="text-right tabular-nums">{t("ops.commutes.seatsOf", { filled: run.seatsFilled, seats: run.seatsPerCar })}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">{t("ops.commutes.noRuns")}</p>
      )}
    </Card>
  )
}

export function CommutesScreen() {
  const t = useT()
  const { isPlatform } = useOps()
  const { data, error } = useOpsData()
  if (!isPlatform) return <PlatformOnly />
  if (error && !data) return <LoadError error={error} />
  if (!data) return <Loading />
  return (
    <>
      <PageHeader title={t("ops.commutes.title")} detail={t("ops.commutes.detail")} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {data.routes.map((route) => (
          <RouteCard key={route.id} route={route} riders={data.riders} trips={data.trips} companyName={data.companies.find((company) => company.id === route.companyId)?.name} riderHref={(id) => `/ops/riders?id=${id}`} />
        ))}
      </div>
    </>
  )
}
