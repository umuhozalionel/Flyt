import { kigaliDay, kigaliMonth } from "./time"
import { activeStatuses } from "./trip-rules"
import type { Rider, Trip } from "./types"

// Rules and figures for the driver app. Pure functions, so tests can check them.

/** What a driver may see about the rider on a trip. The phone number only while the trip is active (assigned to the end of the trip). */
export interface RiderForDriver { firstName: string; phone?: string; rating?: number; tripCount: number }

export function riderForDriver(trip: Trip, rider: Rider | undefined, riderTrips: Trip[]): RiderForDriver {
  const rated = riderTrips.filter((item) => item.status === "completed" && item.driverRating != null)
  const rating = rated.length ? Math.round((rated.reduce((sum, item) => sum + item.driverRating!, 0) / rated.length) * 10) / 10 : undefined
  return {
    firstName: rider?.name.split(/\s+/)[0] ?? "",
    phone: rider && activeStatuses.includes(trip.status) ? rider.phone : undefined,
    rating,
    tripCount: riderTrips.filter((item) => item.status === "completed").length,
  }
}

/** Monday (Kigali calendar) of the week a "YYYY-MM-DD" day is in. */
export function weekStart(day: string) {
  const date = new Date(`${day}T00:00:00Z`)
  const back = (date.getUTCDay() + 6) % 7
  return new Date(date.getTime() - back * 86_400_000).toISOString().slice(0, 10)
}

export interface EarningsPeriod { trips: number; fares: number }
export interface DriverEarnings { today: EarningsPeriod; week: EarningsPeriod; month: EarningsPeriod }

/** Fares of trips the driver completed today, this week (from Monday) and this month, in Kigali time. */
export function driverEarnings(trips: Trip[], driverId: string, now: Date = new Date()): DriverEarnings {
  const today = kigaliDay(now)
  const monday = weekStart(today)
  const month = kigaliMonth(now)
  const done = trips.filter((trip) => trip.driverId === driverId && trip.status === "completed" && trip.completedAt)
  const sum = (rows: Trip[]): EarningsPeriod => ({ trips: rows.length, fares: rows.reduce((total, trip) => total + trip.fare, 0) })
  return {
    today: sum(done.filter((trip) => kigaliDay(trip.completedAt!) === today)),
    week: sum(done.filter((trip) => kigaliDay(trip.completedAt!) >= monday && kigaliDay(trip.completedAt!) <= today)),
    month: sum(done.filter((trip) => kigaliMonth(trip.completedAt!) === month)),
  }
}

/** Google Maps directions link to a place, opened from the driver app. */
export function directionsUrl(place: { lat?: number; lng?: number; name: string }) {
  const destination = place.lat != null && place.lng != null ? `${place.lat},${place.lng}` : `${place.name}, Kigali`
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`
}
