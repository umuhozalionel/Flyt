import { commuteRuns } from "./commute"
import { cancelledStatuses } from "./trip-rules"
import { addDays, daysBetween, kigaliDay } from "./time"
import type { CommuteRoute, Incident, PlanName, Trip } from "./types"

// Pilot report figures. Pure functions so tests can check every number by hand.
// Trips are split by the price plan that priced them (trip.planName): weeks 1 to 4 Baseline, weeks 5 to 8 Test.

export const REPEAT_WINDOW_DAYS = 30

const round1 = (value: number) => Math.round(value * 10) / 10
const round2 = (value: number) => Math.round(value * 100) / 100
const bookedDay = (trip: Pick<Trip, "createdAt">) => kigaliDay(trip.createdAt)

export interface PlanPeriod { plan: PlanName; from: string; to: string; days: number }

/** Each plan's dates: from its first trip to the day before the next plan's first trip (the last one runs to today). */
export function planPeriods(trips: Trip[], today: string = kigaliDay()): PlanPeriod[] {
  const firstDay = new Map<PlanName, string>()
  for (const trip of trips) {
    const day = bookedDay(trip)
    const seen = firstDay.get(trip.planName)
    if (!seen || day < seen) firstDay.set(trip.planName, day)
  }
  const starts = [...firstDay.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  return starts.map(([plan, from], i) => {
    const to = i + 1 < starts.length ? kigaliDay(addDays(new Date(`${starts[i + 1][1]}T12:00:00Z`), -1)) : today
    return { plan, from, to, days: daysBetween(from, to) + 1 }
  })
}

export interface PlanFigures {
  period: PlanPeriod
  booked: number
  completed: number
  fares: number
  tripsPerCarPerDay: number
  faresPerCarPerDay: number
  riders: number
  repeatRiders: number
  repeatPercent: number
  sharedRuns: number
  seatsPerSharedTrip: number
  avgWaitMinutes: number
  cancelled: number
  cancellationPercent: number
  receipts: number
  incidents: number
}

/** Riders with at least two bookings no more than 30 days apart, out of every rider who booked. */
export function repeatRiders(trips: Trip[]) {
  const byRider = new Map<string, number[]>()
  for (const trip of trips) byRider.set(trip.riderId, [...(byRider.get(trip.riderId) ?? []), Date.parse(trip.createdAt)])
  let repeat = 0
  for (const times of byRider.values()) {
    const sorted = times.sort((a, b) => a - b)
    if (sorted.some((time, i) => i > 0 && time - sorted[i - 1] <= REPEAT_WINDOW_DAYS * 86_400_000)) repeat++
  }
  return { riders: byRider.size, repeat }
}

/** Minutes from booking (or the scheduled pickup time) to the driver arriving. */
export const waitMinutes = (trip: Trip) => (trip.arrivedAt ? (Date.parse(trip.arrivedAt) - Date.parse(trip.scheduledFor ?? trip.createdAt)) / 60_000 : undefined)

export function planFigures(period: PlanPeriod, trips: Trip[], carCount: number, routes: CommuteRoute[], incidents: Incident[]): PlanFigures {
  const rows = trips.filter((trip) => trip.planName === period.plan)
  const done = rows.filter((trip) => trip.status === "completed")
  const cancelled = rows.filter((trip) => cancelledStatuses.includes(trip.status))
  const fares = done.reduce((sum, trip) => sum + trip.fare, 0)
  const carDays = carCount * period.days
  const { riders, repeat } = repeatRiders(rows)
  const runs = routes.flatMap((route) => commuteRuns(route, done))
  const waits = rows.map(waitMinutes).filter((value): value is number => value != null)
  const ids = new Set(rows.map((trip) => trip.id))
  const finished = done.length + cancelled.length
  return {
    period,
    booked: rows.length,
    completed: done.length,
    fares,
    tripsPerCarPerDay: carDays ? round2(done.length / carDays) : 0,
    faresPerCarPerDay: carDays ? Math.round(fares / carDays) : 0,
    riders,
    repeatRiders: repeat,
    repeatPercent: riders ? round1((repeat / riders) * 100) : 0,
    sharedRuns: runs.length,
    seatsPerSharedTrip: runs.length ? round1(runs.reduce((sum, run) => sum + run.seatsFilled, 0) / runs.length) : 0,
    avgWaitMinutes: waits.length ? round1(waits.reduce((sum, value) => sum + value, 0) / waits.length) : 0,
    cancelled: cancelled.length,
    cancellationPercent: finished ? round1((cancelled.length / finished) * 100) : 0,
    receipts: done.filter((trip) => !!trip.receiptNo).length,
    incidents: incidents.filter((incident) => (incident.tripId ? ids.has(incident.tripId) : kigaliDay(incident.createdAt) >= period.from && kigaliDay(incident.createdAt) <= period.to)).length,
  }
}

export interface CarRow { carId: string; byPlan: Partial<Record<PlanName, { trips: number; fares: number; tripsPerDay: number; faresPerDay: number }>> }

/** Completed trips and fares per car per day, for each plan. */
export function perCar(carIds: string[], trips: Trip[], periods: PlanPeriod[]): CarRow[] {
  return carIds.map((carId) => {
    const byPlan: CarRow["byPlan"] = {}
    for (const period of periods) {
      const done = trips.filter((trip) => trip.carId === carId && trip.status === "completed" && trip.planName === period.plan)
      const fares = done.reduce((sum, trip) => sum + trip.fare, 0)
      byPlan[period.plan] = { trips: done.length, fares, tripsPerDay: round2(done.length / period.days), faresPerDay: Math.round(fares / period.days) }
    }
    return { carId, byPlan }
  })
}

/** Completed trips per Kigali day over the pilot, for the chart. */
export function tripsPerDay(trips: Trip[], periods: PlanPeriod[]) {
  const rows: { day: string; plan: PlanName; completed: number }[] = []
  for (const period of periods) {
    for (let i = 0; i < period.days; i++) {
      const day = kigaliDay(addDays(new Date(`${period.from}T12:00:00Z`), i))
      rows.push({ day, plan: period.plan, completed: trips.filter((trip) => trip.status === "completed" && trip.completedAt && kigaliDay(trip.completedAt) === day).length })
    }
  }
  return rows
}

export function pilotReport(input: { trips: Trip[]; carIds: string[]; routes: CommuteRoute[]; incidents: Incident[]; today?: string }) {
  const periods = planPeriods(input.trips, input.today)
  return {
    periods,
    plans: periods.map((period) => planFigures(period, input.trips, input.carIds.length, input.routes, input.incidents)),
    cars: perCar(input.carIds, input.trips, periods),
    daily: tripsPerDay(input.trips, periods),
  }
}
