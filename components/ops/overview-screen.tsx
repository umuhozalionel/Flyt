"use client"

import { AlertTriangle, FileWarning, ShieldAlert } from "lucide-react"
import Link from "next/link"
import { FleetMap } from "@/components/shared/fleet-map"
import { StatusBadge } from "@/components/shared/status-badge"
import { formatDate, formatMoney } from "@/lib/format"
import { useT, type TranslationKey } from "@/lib/i18n"
import { documentAlerts, openIncidents, opsKpis, unassignedRequests } from "@/lib/ops"
import { placeName } from "@/lib/places"
import { Card, Kpi, LoadError, Loading, PageHeader } from "./ops-ui"
import { useOpsData } from "./ops-data"

export function OverviewScreen() {
  const t = useT()
  const { data, error } = useOpsData()
  if (error && !data) return <LoadError error={error} />
  if (!data) return <Loading />
  const kpis = opsKpis(data.trips, data.drivers)
  const docs = documentAlerts(data.drivers, data.cars, data.firms)
  const waiting = unassignedRequests(data.trips)
  const incidents = openIncidents(data.incidents)
  const pins = data.drivers
    .filter((driver) => driver.status === "online" || driver.status === "on_trip")
    .map((driver) => ({ id: driver.id, label: `${driver.name} · ${data.cars.find((car) => car.id === driver.carId)?.plate ?? ""}`, zone: driver.zone, state: driver.status as "online" | "on_trip" }))

  return (
    <>
      <PageHeader title={t("ops.overview.title")} detail={t("ops.overview.detail")} />
      {/* Map first: the live map leads the overview. */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card title={t("ops.overview.map")}>
          <FleetMap pins={pins} />
        </Card>
        <div className="flex flex-col gap-4">
          <Card title={t("ops.alerts.unassigned", { count: waiting.length })} action={<Link href="/ops/dispatch" className="text-sm font-semibold text-primary">{t("ops.alerts.openDispatch")}</Link>}>
            {waiting.length ? (
              <ul className="flex flex-col gap-2">
                {waiting.slice(0, 5).map((trip) => (
                  <li key={trip.id} className="flex items-center gap-2 text-sm">
                    <AlertTriangle className="size-4 shrink-0 text-amber-600" />
                    <Link href={`/ops/trips?id=${trip.id}`} className="min-w-0 flex-1 truncate hover:underline">
                      {trip.id} · {placeName(trip.pickup)} → {placeName(trip.dropoff)}
                    </Link>
                    <StatusBadge status={trip.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">{t("ops.alerts.noneWaiting")}</p>
            )}
          </Card>
          <Card title={t("ops.alerts.documents", { count: docs.length })}>
            {docs.length ? (
              <ul className="flex flex-col gap-2">
                {docs.slice(0, 8).map((alert) => (
                  <li key={`${alert.ownerId}-${alert.docType}`} className="flex items-center gap-2 text-sm">
                    <FileWarning className={`size-4 shrink-0 ${alert.status === "expiring_soon" ? "text-amber-600" : "text-destructive"}`} />
                    <Link href={alert.kind === "firm" ? `/ops/firms?id=${alert.ownerId}` : `/ops/${alert.kind}s?id=${alert.ownerId}`} className="min-w-0 flex-1 truncate hover:underline">
                      {alert.ownerName} · {t(`doc.${alert.docType}` as TranslationKey)}
                    </Link>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {alert.status === "missing" || alert.status === "rejected" ? t(`status.${alert.status}`) : alert.daysLeft! < 0 ? t("ops.alerts.expiredAgo", { days: -alert.daysLeft! }) : t("ops.alerts.expiresIn", { days: alert.daysLeft! })}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">{t("ops.alerts.noDocs")}</p>
            )}
          </Card>
          <Card title={t("ops.alerts.incidents", { count: incidents.length })}>
            {incidents.length ? (
              <ul className="flex flex-col gap-2">
                {incidents.map((incident) => (
                  <li key={incident.id} className="flex items-start gap-2 text-sm">
                    <ShieldAlert className={`mt-0.5 size-4 shrink-0 ${incident.type === "safety" ? "text-destructive" : "text-amber-600"}`} />
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">
                        {t(`incident.type.${incident.type}` as TranslationKey)} · {t(`incident.status.${incident.status}` as TranslationKey)}
                      </span>
                      <span className="block truncate text-muted-foreground">{incident.description}</span>
                      <span className="block text-xs text-muted-foreground">
                        {formatDate(incident.createdAt)}
                        {incident.tripId && (
                          <>
                            {" · "}
                            <Link href={`/ops/trips?id=${incident.tripId}`} className="text-primary hover:underline">
                              {incident.tripId}
                            </Link>
                          </>
                        )}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">{t("ops.alerts.noIncidents")}</p>
            )}
          </Card>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label={t("ops.kpi.active")} value={kpis.activeTrips} />
        <Kpi label={t("ops.kpi.online")} value={kpis.onlineDrivers} detail={t("ops.kpi.onTrip", { count: kpis.onTripDrivers })} />
        <Kpi label={t("ops.kpi.waiting")} value={kpis.waitingRequests} detail={t("ops.kpi.scheduled", { count: kpis.scheduledRequests })} />
        <Kpi label={t("ops.kpi.tripsToday")} value={kpis.tripsToday} detail={t("ops.kpi.completedOnly")} />
        <Kpi label={t("ops.kpi.faresToday")} value={formatMoney(kpis.faresToday)} />
        <Kpi label={t("ops.kpi.feesToday")} value={formatMoney(kpis.feesToday)} />
      </div>
    </>
  )
}
