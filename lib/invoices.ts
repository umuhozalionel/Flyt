import { kigaliMonth } from "./time"
import type { CompanyInvoice, FeeInvoice, Firm, Trip } from "./types"

// Invoice totals. Postgres generate_invoices() uses the same rules.
// A fee invoice counts a firm's completed trips in the period (by completion time, Kigali month).
// A company invoice counts completed trips billed to the company in the period.

function completedIn(trip: Trip, period: string) {
  return trip.status === "completed" && !!trip.completedAt && kigaliMonth(trip.completedAt) === period
}

export function feeInvoiceFor(firm: Pick<Firm, "id">, trips: Trip[], period: string): Omit<FeeInvoice, "id" | "status"> {
  const rows = trips.filter((trip) => trip.firmId === firm.id && completedIn(trip, period))
  return {
    firmId: firm.id,
    period,
    tripCount: rows.length,
    faresTotal: rows.reduce((sum, trip) => sum + trip.fare, 0),
    feeTotal: rows.reduce((sum, trip) => sum + trip.platformFee, 0),
  }
}

export function companyInvoiceFor(companyId: string, trips: Trip[], period: string): Omit<CompanyInvoice, "id" | "status"> {
  const rows = trips.filter((trip) => trip.companyId === companyId && trip.paymentMethod === "company_account" && completedIn(trip, period))
  return { companyId, period, tripCount: rows.length, total: rows.reduce((sum, trip) => sum + trip.fare, 0) }
}
