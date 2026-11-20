import { kigaliMonth } from "./time"
import type { CompanyInvoice, FeeInvoice, Firm, InvoiceAdjustment, InvoiceLine, InvoiceStatus, Trip } from "./types"

// Invoice totals. Postgres generate_invoices() uses the same rules.
// A fee invoice counts a firm's completed trips in the period (by completion time, Kigali month).
// A company invoice counts completed trips billed to the company in the period.
// A trip voided to a fare of 0 is not billed.
// Sent and paid invoices never change. When a trip on one is corrected later, the difference goes
// on the next invoice made for that firm or company, as an adjustment line.

function completedIn(trip: Trip, period: string) {
  return trip.status === "completed" && !!trip.completedAt && kigaliMonth(trip.completedAt) === period
}

const isSent = (status: InvoiceStatus) => status === "sent" || status === "paid"
const sum = (rows: { fare: number; fee: number }[], key: "fare" | "fee") => rows.reduce((total, row) => total + row[key], 0)

type AnyInvoice = Pick<FeeInvoice, "id" | "period" | "status" | "lines" | "adjustments">

/**
 * Adjustment lines for an invoice in `period`: trips completed in an earlier month that sit on a sent
 * or paid invoice, and whose fare or fee now differs from everything already billed for them.
 * `others` are the holder's other invoices (not the one being made).
 */
export function adjustmentsFor(trips: Trip[], period: string, others: AnyInvoice[]): InvoiceAdjustment[] {
  const rows: InvoiceAdjustment[] = []
  for (const trip of trips) {
    if (trip.status !== "completed" || !trip.completedAt || kigaliMonth(trip.completedAt) >= period) continue
    const origin = others.find((invoice) => invoice.period < period && isSent(invoice.status) && invoice.lines.some((line) => line.tripId === trip.id))
    if (!origin) continue
    const billed = others.flatMap((invoice) => [...invoice.lines, ...invoice.adjustments].filter((line) => line.tripId === trip.id))
    const fare = trip.fare - sum(billed, "fare")
    const fee = trip.platformFee - sum(billed, "fee")
    if (fare || fee) rows.push({ tripId: trip.id, fromPeriod: origin.period, fare, fee, reason: trip.corrections?.at(-1)?.reason ?? "Fare corrected" })
  }
  return rows
}

const lineOf = (trip: Trip): InvoiceLine => ({ tripId: trip.id, fare: trip.fare, fee: trip.platformFee })

export function feeInvoiceFor(firm: Pick<Firm, "id">, trips: Trip[], period: string, others: AnyInvoice[] = []): Omit<FeeInvoice, "id" | "status"> {
  const mine = trips.filter((trip) => trip.firmId === firm.id)
  const lines = mine.filter((trip) => completedIn(trip, period) && trip.fare > 0).map(lineOf)
  const adjustments = adjustmentsFor(mine, period, others)
  return {
    firmId: firm.id,
    period,
    tripCount: lines.length,
    faresTotal: sum(lines, "fare") + sum(adjustments, "fare"),
    feeTotal: sum(lines, "fee") + sum(adjustments, "fee"),
    lines,
    adjustments,
  }
}

export const isBilledToCompany = (trip: Trip, companyId: string) => trip.companyId === companyId && trip.paymentMethod === "company_account"

export function companyInvoiceFor(companyId: string, trips: Trip[], period: string, others: AnyInvoice[] = []): Omit<CompanyInvoice, "id" | "status"> {
  const mine = trips.filter((trip) => isBilledToCompany(trip, companyId))
  const lines = mine.filter((trip) => completedIn(trip, period) && trip.fare > 0).map(lineOf)
  const adjustments = adjustmentsFor(mine, period, others)
  return { companyId, period, tripCount: lines.length, total: sum(lines, "fare") + sum(adjustments, "fare"), lines, adjustments }
}

/** The months that can be invoiced: past months, and the current month as a draft that is refreshed until it is sent. */
export function canInvoicePeriod(period: string, now: Date = new Date()) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(period) && period <= kigaliMonth(now)
}

/** Invoices only move forward: draft → sent → paid. */
export const nextInvoiceStatus: Record<InvoiceStatus, InvoiceStatus | undefined> = { draft: "sent", sent: "paid", paid: undefined }

export interface GeneratedInvoices { feeInvoices: FeeInvoice[]; companyInvoices: CompanyInvoice[]; created: number; refreshed: number }

/**
 * Fee invoices for every active firm and company invoices for every company with trips (or adjustments) in the period.
 * A new invoice starts as a draft. A draft is recalculated; a sent or paid invoice is never changed.
 * Firms and companies with nothing to bill in the period get no invoice.
 */
export function generateInvoices(period: string, firms: Pick<Firm, "id" | "status">[], companies: { id: string }[], trips: Trip[], feeInvoices: FeeInvoice[], companyInvoices: CompanyInvoice[]): GeneratedInvoices {
  let created = 0
  let refreshed = 0
  const fees = [...feeInvoices]
  for (const firm of firms) {
    const index = fees.findIndex((invoice) => invoice.firmId === firm.id && invoice.period === period)
    if (index >= 0 && fees[index].status !== "draft") continue
    const others = fees.filter((invoice, i) => invoice.firmId === firm.id && i !== index)
    const totals = feeInvoiceFor(firm, trips, period, others)
    if (index >= 0) {
      fees[index] = { ...fees[index], ...totals }
      refreshed++
    } else if (firm.status === "active" && (totals.lines.length || totals.adjustments.length)) {
      fees.push({ id: `FI-${period}-${firm.id}`, ...totals, status: "draft" })
      created++
    }
  }
  const bills = [...companyInvoices]
  for (const company of companies) {
    const index = bills.findIndex((invoice) => invoice.companyId === company.id && invoice.period === period)
    if (index >= 0 && bills[index].status !== "draft") continue
    const others = bills.filter((invoice, i) => invoice.companyId === company.id && i !== index)
    const totals = companyInvoiceFor(company.id, trips, period, others)
    if (index >= 0) {
      bills[index] = { ...bills[index], ...totals }
      refreshed++
    } else if (totals.lines.length || totals.adjustments.length) {
      bills.push({ id: `CI-${period}-${company.id}`, ...totals, status: "draft" })
      created++
    }
  }
  return { feeInvoices: fees, companyInvoices: bills, created, refreshed }
}
