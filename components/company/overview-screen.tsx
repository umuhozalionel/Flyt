"use client"

import Link from "next/link"
import { StatusBadge } from "@/components/shared/status-badge"
import { companyMonth } from "@/lib/company"
import { commuteRuns } from "@/lib/commute"
import { formatDay, formatMoney } from "@/lib/format"
import { useT } from "@/lib/i18n"
import { placeName } from "@/lib/places"
import { kigaliMonth } from "@/lib/time"
import { useCompanyData } from "./company-data"
import { Card, Kpi, LoadError, NoCompany, PageHeader } from "./company-ui"

export function CompanyOverview() {
  const t = useT()
  const { data, error } = useCompanyData()
  if (error && !data) return <LoadError error={error} />
  if (!data) return <NoCompany />
  const month = companyMonth(data.trips, data.company.id)
  const unpaid = data.invoices.filter((invoice) => invoice.status === "sent").reduce((sum, invoice) => sum + invoice.total, 0)
  const runs = data.routes.flatMap((route) => commuteRuns(route, data.trips.filter((trip) => trip.status === "completed"))).filter((run) => run.day.startsWith(kigaliMonth()))
  const seats = runs.reduce((sum, run) => sum + run.seatsFilled, 0)
  const recent = data.trips.slice(0, 6)
  const name = (riderId: string) => data.people.find((rider) => rider.id === riderId)?.name ?? "—"
  return (
    <>
      <PageHeader title={data.company.name} detail={t("company.overview.detail", { month: kigaliMonth() })} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label={t("company.overview.trips")} value={month.trips} detail={t("company.overview.tripsDetail")} />
        <Kpi label={t("company.overview.spend")} value={formatMoney(month.spend)} detail={t("company.overview.spendDetail")} />
        <Kpi label={t("company.overview.staff")} value={data.staff.length} detail={t("company.overview.staffDetail", { total: data.company.staffCount })} />
        <Kpi label={t("company.overview.unpaid")} value={formatMoney(unpaid)} detail={t("company.overview.unpaidDetail")} />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title={t("company.overview.recent")} action={<Link href="/company/trips" className="text-sm font-medium hover:underline">{t("company.overview.allTrips")}</Link>}>
          {recent.length ? (
            <ul className="divide-y text-sm">
              {recent.map((trip) => (
                <li key={trip.id} className="flex flex-wrap items-center gap-2 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{name(trip.riderId)}</span>
                    <span className="block text-xs text-muted-foreground">
                      {formatDay(trip.scheduledFor ?? trip.createdAt)} · {placeName(trip.pickup)} → {placeName(trip.dropoff)}
                    </span>
                  </span>
                  <span className="font-semibold tabular-nums">{formatMoney(trip.fare)}</span>
                  <StatusBadge status={trip.status} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{t("company.trips.none")}</p>
          )}
        </Card>
        <Card title={t("company.overview.commutes")} action={<Link href="/company/routes" className="text-sm font-medium hover:underline">{t("company.overview.allRoutes")}</Link>}>
          <p className="text-sm">{runs.length ? t("company.overview.commuteDetail", { runs: runs.length, seats }) : t("company.overview.noCommutes")}</p>
          <ul className="mt-3 divide-y text-sm">
            {data.routes.map((route) => (
              <li key={route.id} className="py-2">
                <span className="font-medium">{route.name}</span>
                <span className="block text-xs text-muted-foreground">{t("company.overview.routeLine", { times: route.departureTimes.join(", "), riders: route.riderIds.length })}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">{t("company.privacyNote")}</p>
    </>
  )
}
