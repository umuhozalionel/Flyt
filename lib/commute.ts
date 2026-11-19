import { cancelledStatuses } from "./trip-rules"
import { kigaliDay, KIGALI_TZ } from "./time"
import type { CommuteRoute, Trip } from "./types"

// Shared commutes: each seat is its own trip with commuteRouteId set. A "run" is one car
// on a route on one day at one departure time. Seats filled = seat trips in that run that were not cancelled.

const minutesFormat = new Intl.DateTimeFormat("en-GB", { timeZone: KIGALI_TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
const minutesOfDay = (iso: string) => {
  const [h, m] = minutesFormat.format(new Date(iso)).split(":").map(Number)
  return h * 60 + m
}
const toMinutes = (time: string) => {
  const [h, m] = time.split(":").map(Number)
  return h * 60 + m
}

/** The route departure time closest to when a seat trip was booked for (Kigali time). */
export function departureFor(route: Pick<CommuteRoute, "departureTimes">, trip: Pick<Trip, "scheduledFor" | "createdAt">) {
  const at = minutesOfDay(trip.scheduledFor ?? trip.createdAt)
  return [...route.departureTimes].sort((a, b) => Math.abs(toMinutes(a) - at) - Math.abs(toMinutes(b) - at))[0] ?? "—"
}

export interface CommuteRun { routeId: string; day: string; departure: string; seatsFilled: number; seatsPerCar: number; tripIds: string[] }

/** Runs on a route, newest first. */
export function commuteRuns(route: CommuteRoute, trips: Trip[]): CommuteRun[] {
  const runs = new Map<string, CommuteRun>()
  for (const trip of trips) {
    if (trip.type !== "shared_commute" || trip.commuteRouteId !== route.id || cancelledStatuses.includes(trip.status)) continue
    const day = kigaliDay(trip.scheduledFor ?? trip.createdAt)
    const departure = departureFor(route, trip)
    const key = `${day} ${departure}`
    const run = runs.get(key) ?? { routeId: route.id, day, departure, seatsFilled: 0, seatsPerCar: route.seatsPerCar, tripIds: [] }
    run.seatsFilled++
    run.tripIds.push(trip.id)
    runs.set(key, run)
  }
  return [...runs.values()].sort((a, b) => `${b.day} ${b.departure}`.localeCompare(`${a.day} ${a.departure}`))
}
