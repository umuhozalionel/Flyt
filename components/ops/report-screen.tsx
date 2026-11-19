"use client"

import { useState } from "react"
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table"
import { formatDay, formatMoney } from "@/lib/format"
import { useT, type TranslationKey } from "@/lib/i18n"
import { pilotReport, type PlanFigures } from "@/lib/report"
import type { PlanName } from "@/lib/types"
import { useOps } from "./ops-context"
import { useOpsData } from "./ops-data"
import { Card, LoadError, Loading, PageHeader } from "./ops-ui"

// Plan colours, checked with the colour validator for light and dark surfaces (identity only;
// every bar also has a label in the legend, the period labels and the tooltip).
const planColour: Record<PlanName, string> = {
  Baseline: "bg-[#7468b0] dark:bg-[#857ac4]",
  Test: "bg-[#008e53] dark:bg-[#2cab70]",
}

type Row = { label: TranslationKey; value: (plan: PlanFigures) => string }

export function ReportScreen() {
  const t = useT()
  const { isPlatform } = useOps()
  const { data, error } = useOpsData()
  if (error && !data) return <LoadError error={error} />
  if (!data) return <Loading />
  const report = pilotReport({ trips: data.trips, carIds: data.cars.map((car) => car.id), routes: data.routes, incidents: data.incidents })
  const pct = (value: number) => `${value.toFixed(1)}%`
  const rows: Row[] = [
    { label: "ops.report.days", value: (plan) => t("ops.report.daysValue", { days: plan.period.days, from: formatDay(`${plan.period.from}T10:00:00Z`), to: formatDay(`${plan.period.to}T10:00:00Z`) }) },
    { label: "ops.report.booked", value: (plan) => String(plan.booked) },
    { label: "ops.report.completed", value: (plan) => String(plan.completed) },
    { label: "ops.report.tripsPerCar", value: (plan) => plan.tripsPerCarPerDay.toFixed(2) },
    { label: "ops.report.faresPerCar", value: (plan) => formatMoney(plan.faresPerCarPerDay) },
    { label: "ops.report.repeat", value: (plan) => `${pct(plan.repeatPercent)} (${plan.repeatRiders} / ${plan.riders})` },
    { label: "ops.report.seats", value: (plan) => (plan.sharedRuns ? t("ops.report.seatsValue", { seats: plan.seatsPerSharedTrip.toFixed(1), runs: plan.sharedRuns }) : "—") },
    { label: "ops.report.wait", value: (plan) => t("ops.report.minutes", { min: plan.avgWaitMinutes.toFixed(1) }) },
    { label: "ops.report.cancellation", value: (plan) => `${pct(plan.cancellationPercent)} (${plan.cancelled})` },
    { label: "ops.report.receipts", value: (plan) => String(plan.receipts) },
    { label: "ops.report.incidents", value: (plan) => String(plan.incidents) },
  ]

  return (
    <>
      <PageHeader title={t("ops.report.title")} detail={isPlatform ? t("ops.report.detail", { cars: data.cars.length }) : t("ops.report.detailFirm", { cars: data.cars.length })} />
      <div className="grid grid-cols-1 gap-4">
        <Card title={t("ops.report.compare")}>
          <Table className="min-w-[520px]">
            <THead>
              <tr>
                <Th>{t("ops.report.measure")}</Th>
                {report.plans.map((plan) => (
                  <Th key={plan.period.plan} className="text-right">
                    <span className="inline-flex items-center gap-2">
                      <span aria-hidden className={`size-2.5 rounded-sm ${planColour[plan.period.plan]}`} />
                      {plan.period.plan}
                    </span>
                  </Th>
                ))}
              </tr>
            </THead>
            <TBody>
              {rows.map((row) => (
                <Tr key={row.label}>
                  <Td className="font-medium">{t(row.label)}</Td>
                  {report.plans.map((plan) => (
                    <Td key={plan.period.plan} className="text-right tabular-nums">
                      {row.value(plan)}
                    </Td>
                  ))}
                </Tr>
              ))}
            </TBody>
          </Table>
          <p className="mt-3 text-xs text-muted-foreground">{t("ops.report.notes")}</p>
        </Card>
        <TripsChart daily={report.daily} />
        <Card title={t("ops.report.perCar")}>
          <Table>
            <THead>
              <tr>
                <Th>{t("ops.report.car")}</Th>
                {report.periods.map((period) => (
                  <Th key={period.plan} className="text-right">
                    {t("ops.report.carColumn", { plan: period.plan })}
                  </Th>
                ))}
              </tr>
            </THead>
            <TBody>
              {report.cars.map((row) => {
                const car = data.cars.find((item) => item.id === row.carId)
                return (
                  <Tr key={row.carId}>
                    <Td className="font-medium">
                      {car?.plate}
                      <span className="block text-xs text-muted-foreground">{data.allFirms.find((firm) => firm.id === car?.firmId)?.name}</span>
                    </Td>
                    {report.periods.map((period) => {
                      const cell = row.byPlan[period.plan]
                      return (
                        <Td key={period.plan} className="text-right tabular-nums">
                          {cell ? t("ops.report.carCell", { trips: cell.tripsPerDay.toFixed(2), fares: formatMoney(cell.faresPerDay), total: cell.trips }) : "—"}
                        </Td>
                      )
                    })}
                  </Tr>
                )
              })}
            </TBody>
          </Table>
        </Card>
      </div>
    </>
  )
}

/** Completed trips per day over the pilot, one bar per day, coloured by the price plan in use. */
function TripsChart({ daily }: { daily: { day: string; plan: PlanName; completed: number }[] }) {
  const t = useT()
  const [hover, setHover] = useState<number>()
  const max = Math.max(1, ...daily.map((row) => row.completed))
  const plans = [...new Set(daily.map((row) => row.plan))]
  const shown = hover != null ? daily[hover] : undefined
  return (
    <Card title={t("ops.report.chart")}>
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground" aria-hidden>
        {plans.map((plan) => (
          <span key={plan} className="inline-flex items-center gap-2">
            <span className={`size-2.5 rounded-sm ${planColour[plan]}`} /> {t("ops.report.legend", { plan })}
          </span>
        ))}
      </div>
      <div className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-border" />
        <span className="pointer-events-none absolute -top-2 left-0 bg-card pr-1 text-[10px] text-muted-foreground">{t("ops.report.max", { max })}</span>
        <div className="flex h-40 items-end gap-[2px] border-b border-border pt-3" role="list" aria-label={t("ops.report.chart")} onMouseLeave={() => setHover(undefined)}>
          {daily.map((row, i) => (
            <div
              key={row.day}
              role="listitem"
              tabIndex={0}
              aria-label={t("ops.report.barLabel", { day: formatDay(`${row.day}T10:00:00Z`), plan: row.plan, count: row.completed })}
              className="flex h-full min-w-0 flex-1 items-end outline-none focus-visible:bg-secondary"
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(undefined)}
            >
              <div className={`w-full rounded-t-[4px] ${planColour[row.plan]} ${hover === i ? "opacity-80" : ""}`} style={{ height: row.completed ? `${(row.completed / max) * 100}%` : 0 }} />
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
          <span>{daily[0] && formatDay(`${daily[0].day}T10:00:00Z`)}</span>
          <span>{daily.at(-1) && formatDay(`${daily.at(-1)!.day}T10:00:00Z`)}</span>
        </div>
      </div>
      <p className="mt-2 min-h-5 text-sm" aria-live="polite">
        {shown ? t("ops.report.barLabel", { day: formatDay(`${shown.day}T10:00:00Z`), plan: shown.plan, count: shown.completed }) : <span className="text-muted-foreground">{t("ops.report.chartHint")}</span>}
      </p>
    </Card>
  )
}
