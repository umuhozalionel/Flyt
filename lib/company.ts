import { kigaliMonth } from "./time"
import type { Rider, Trip } from "./types"

// Rules for what a client company sees (rule b): only trips billed to the company and
// shared commute seats, never staff's own rides paid by MoMo or Airtel.

export function isCompanyTrip(trip: Pick<Trip, "companyId" | "paymentMethod" | "type">, companyId: string) {
  return trip.companyId === companyId && (trip.paymentMethod === "company_account" || trip.type === "shared_commute")
}

export const companyTrips = (trips: Trip[], companyId: string) => trips.filter((trip) => isCompanyTrip(trip, companyId))

export const companyStaff = (riders: Rider[], companyId: string) => riders.filter((rider) => rider.companyId === companyId)

/** Company trips completed in a Kigali month, and what they cost the company. */
export function companyMonth(trips: Trip[], companyId: string, period: string = kigaliMonth()) {
  const rows = companyTrips(trips, companyId).filter((trip) => trip.status === "completed" && !!trip.completedAt && kigaliMonth(trip.completedAt) === period)
  return { trips: rows.length, spend: rows.reduce((sum, trip) => sum + trip.fare, 0) }
}

/** A join code from the company name, e.g. "Akagera Group" → "AKAGERA-42". */
export function makeJoinCode(name: string, taken: string[], random: () => number = Math.random) {
  const word = (name.trim().split(/\s+/)[0] ?? "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 10) || "FLYT"
  for (let tries = 0; tries < 100; tries++) {
    const code = `${word}-${String(10 + Math.floor(random() * 90))}`
    if (!taken.some((item) => item.toLowerCase() === code.toLowerCase())) return code
  }
  return `${word}-${Date.now().toString().slice(-4)}`
}
