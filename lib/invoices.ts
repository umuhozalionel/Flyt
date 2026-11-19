import { kigaliMonth } from "./time"
import type { CompanyInvoice, FeeInvoice, Firm, InvoiceStatus, Trip } from "./types"

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

/** The months that can be invoiced: past months, and the current month as a draft that is refreshed until it is sent. */
export function canInvoicePeriod(period: string, now: Date = new Date()) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(period) && period <= kigaliMonth(now)
}

/** Invoices only move forward: draft → sent → paid. */
export const nextInvoiceStatus: Record<InvoiceStatus, InvoiceStatus | undefined> = { draft: "sent", sent: "paid", paid: undefined }

export interface GeneratedInvoices { feeInvoices: FeeInvoice[]; companyInvoices: CompanyInvoice[]; created: number; refreshed: number }

/**
 * Fee invoices for every active firm and company invoices for every company with trips in the period.
 * A new invoice starts as a draft. A draft is recalculated; a sent or paid invoice is never changed.
 * Firms and companies with no completed trips in the period get no invoice.
 */
export function generateInvoices(period: string, firms: Pick<Firm, "id" | "status">[], companies: { id: string }[], trips: Trip[], feeInvoices: FeeInvoice[], companyInvoices: CompanyInvoice[]): GeneratedInvoices {
  let created = 0
  let refreshed = 0
  const fees = [...feeInvoices]
  for (const firm of firms) {
    const totals = feeInvoiceFor(firm, trips, period)
    const index = fees.findIndex((invoice) => invoice.firmId === firm.id && invoice.period === period)
    if (index >= 0) {
      if (fees[index].status === "draft") {
        fees[index] = { ...fees[index], ...totals }
        refreshed++
      }
    } else if (firm.status === "active" && totals.tripCount > 0) {
      fees.push({ id: `FI-${period}-${firm.id}`, ...totals, status: "draft" })
      created++
    }
  }
  const bills = [...companyInvoices]
  for (const company of companies) {
    const totals = companyInvoiceFor(company.id, trips, period)
    const index = bills.findIndex((invoice) => invoice.companyId === company.id && invoice.period === period)
    if (index >= 0) {
      if (bills[index].status === "draft") {
        bills[index] = { ...bills[index], ...totals }
        refreshed++
      }
    } else if (totals.tripCount > 0) {
      bills.push({ id: `CI-${period}-${company.id}`, ...totals, status: "draft" })
      created++
    }
  }
  return { feeInvoices: fees, companyInvoices: bills, created, refreshed }
}
