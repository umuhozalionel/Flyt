import { documentStatus, EXPIRY_WARNING_DAYS } from "./documents"
import { feeInvoiceFor } from "./invoices"
import { kmBetween } from "./eta"
import { daysBetween, kigaliDay, kigaliMonth } from "./time"
import { activeStatuses } from "./trip-rules"
import type { AdminUser, Car, ComplianceDocument, DocumentStatus, DocumentType, Driver, FeeInvoice, Firm, Incident, PlaceId, Trip } from "./types"

// Figures and rules for the Flyt Operations dashboard. Pure functions, so tests can check every number.

/** What an Ops user may see. A firm admin sees only their own firm; a platform admin sees everything. */
export interface OpsScope { firmId?: string }

export function scopeFor(admin: Pick<AdminUser, "role" | "firmId"> | undefined): OpsScope {
  return admin?.role === "firm_admin" ? { firmId: admin.firmId } : {}
}

export const inScope = (scope: OpsScope) => (row: { firmId: string }) => !scope.firmId || row.firmId === scope.firmId
export const firmInScope = (scope: OpsScope) => (firm: Pick<Firm, "id">) => !scope.firmId || firm.id === scope.firmId

/** Kigali day a trip belongs to: its scheduled time, or when it was booked. */
export const tripDay = (trip: Pick<Trip, "scheduledFor" | "createdAt">) => kigaliDay(trip.scheduledFor ?? trip.createdAt)

export interface OpsKpis {
  activeTrips: number
  onlineDrivers: number
  onTripDrivers: number
  waitingRequests: number
  scheduledRequests: number
  /** Trips completed today (Kigali time). */
  tripsToday: number
  faresToday: number
  feesToday: number
}

export function opsKpis(trips: Trip[], drivers: Driver[], today: string = kigaliDay()): OpsKpis {
  const doneToday = trips.filter((trip) => trip.status === "completed" && trip.completedAt && kigaliDay(trip.completedAt) === today)
  return {
    activeTrips: trips.filter((trip) => activeStatuses.includes(trip.status)).length,
    onlineDrivers: drivers.filter((driver) => driver.status === "online" || driver.status === "on_trip").length,
    onTripDrivers: drivers.filter((driver) => driver.status === "on_trip").length,
    waitingRequests: trips.filter((trip) => trip.status === "requested").length,
    scheduledRequests: trips.filter((trip) => trip.status === "scheduled").length,
    tripsToday: doneToday.length,
    faresToday: doneToday.reduce((sum, trip) => sum + trip.fare, 0),
    feesToday: doneToday.reduce((sum, trip) => sum + trip.platformFee, 0),
  }
}

const severity: DocumentStatus[] = ["expired", "rejected", "missing", "expiring_soon", "pending_review", "valid"]

/** The status that needs attention first among a set of documents. */
export function worstDocumentStatus(documents: ComplianceDocument[], today?: string): DocumentStatus {
  const statuses = documents.map((doc) => documentStatus(doc, today))
  return severity.find((status) => statuses.includes(status)) ?? "valid"
}

export interface DocumentAlert {
  kind: "driver" | "car" | "firm"
  ownerId: string
  ownerName: string
  firmId: string
  docType: DocumentType | "rura_licence"
  status: "expired" | "rejected" | "missing" | "expiring_soon"
  expiryDate?: string
  /** Days until expiry; negative when already expired. */
  daysLeft?: number
}

/** Documents and firm licences that are expired, rejected, missing, or expire within 30 days. Most urgent first. */
export function documentAlerts(drivers: Driver[], cars: Car[], firms: Firm[], today: string = kigaliDay()): DocumentAlert[] {
  const alerts: DocumentAlert[] = []
  const add = (kind: DocumentAlert["kind"], ownerId: string, ownerName: string, firmId: string, doc: ComplianceDocument) => {
    const status = documentStatus(doc, today)
    if (status !== "expired" && status !== "rejected" && status !== "missing" && status !== "expiring_soon") return
    const dated = status !== "missing" && status !== "rejected" && doc.expiryDate
    alerts.push({ kind, ownerId, ownerName, firmId, docType: doc.type, status, expiryDate: dated ? doc.expiryDate : undefined, daysLeft: dated ? daysBetween(today, doc.expiryDate!) : undefined })
  }
  for (const driver of drivers) for (const doc of driver.documents) add("driver", driver.id, driver.name, driver.firmId, doc)
  for (const car of cars) for (const doc of car.documents) add("car", car.id, car.plate, car.firmId, doc)
  for (const firm of firms) {
    const daysLeft = daysBetween(today, firm.licenceExpiry)
    if (daysLeft <= EXPIRY_WARNING_DAYS) alerts.push({ kind: "firm", ownerId: firm.id, ownerName: firm.name, firmId: firm.id, docType: "rura_licence", status: daysLeft < 0 ? "expired" : "expiring_soon", expiryDate: firm.licenceExpiry, daysLeft })
  }
  const rank = (alert: DocumentAlert) => (alert.status === "expired" ? 0 : alert.status === "rejected" || alert.status === "missing" ? 1 : 2)
  return alerts.sort((a, b) => rank(a) - rank(b) || (a.daysLeft ?? 0) - (b.daysLeft ?? 0))
}

/** Minutes before a scheduled pickup when it counts as unassigned and needs a driver now. */
export const SCHEDULED_ALERT_MINUTES = 60

/** Requests waiting for a driver now: every requested trip, and scheduled trips due within the hour. */
export function unassignedRequests(trips: Trip[], now: Date = new Date()): Trip[] {
  const soon = now.getTime() + SCHEDULED_ALERT_MINUTES * 60_000
  return trips
    .filter((trip) => trip.status === "requested" || (trip.status === "scheduled" && !!trip.scheduledFor && Date.parse(trip.scheduledFor) <= soon))
    .sort((a, b) => (a.scheduledFor ?? a.createdAt).localeCompare(b.scheduledFor ?? b.createdAt))
}

export const openIncidents = (incidents: Incident[]) => incidents.filter((incident) => incident.status !== "closed")

export interface DriverSuggestion { driver: Driver; car: Car; firm: Firm; km: number }

/** Road km from a driver's zone to the pickup. 0 when they are in the same place. */
export function kmToPickup(zone: PlaceId, pickup: PlaceId) {
  return kmBetween(zone, pickup)
}

/**
 * Drivers who can take a trip now, nearest first (then best rated). The same checks run when
 * Ops assigns: approved, online, has an available car, firm active, and hire trips stay with the booked firm.
 */
export function suggestDrivers(trip: Trip, drivers: Driver[], cars: Car[], firms: Firm[], scope: OpsScope = {}, limit = 3): DriverSuggestion[] {
  const hire = trip.type === "hourly" || trip.type === "daily"
  const rows: DriverSuggestion[] = []
  for (const driver of drivers) {
    if (driver.id === trip.driverId || driver.approval !== "approved" || driver.status !== "online") continue
    if (scope.firmId && driver.firmId !== scope.firmId) continue
    if (hire && driver.firmId !== trip.firmId) continue
    const car = cars.find((item) => item.id === driver.carId)
    const firm = firms.find((item) => item.id === driver.firmId)
    if (!car || car.availability !== "available" || !firm || firm.status !== "active") continue
    rows.push({ driver, car, firm, km: kmToPickup(driver.zone, trip.pickup) })
  }
  return rows.sort((a, b) => a.km - b.km || b.driver.rating - a.driver.rating).slice(0, limit)
}

export interface FeesOwed {
  /** Fee invoices sent or drafted and not yet paid. */
  invoiced: number
  /** Fees on trips completed this month, not invoiced yet. */
  thisMonth: number
  total: number
}

/** Platform fees a firm owes Flyt Ltd. */
export function feesOwed(firm: Pick<Firm, "id">, trips: Trip[], invoices: FeeInvoice[], now: Date = new Date()): FeesOwed {
  const period = kigaliMonth(now)
  const invoiced = invoices.filter((invoice) => invoice.firmId === firm.id && invoice.status !== "paid").reduce((sum, invoice) => sum + invoice.feeTotal, 0)
  const alreadyInvoiced = invoices.some((invoice) => invoice.firmId === firm.id && invoice.period === period)
  const thisMonth = alreadyInvoiced ? 0 : feeInvoiceFor(firm, trips, period).feeTotal
  return { invoiced, thisMonth, total: invoiced + thisMonth }
}

export type TimelineStep = "createdAt" | "scheduledFor" | "assignedAt" | "acceptedAt" | "arrivedAt" | "startedAt" | "completedAt" | "cancelledAt" | "riderPaidAt" | "paidAt"
const timelineSteps: TimelineStep[] = ["createdAt", "scheduledFor", "assignedAt", "acceptedAt", "arrivedAt", "startedAt", "completedAt", "cancelledAt", "riderPaidAt", "paidAt"]

/** The times a trip has reached, in order. */
export function tripTimeline(trip: Trip): { step: TimelineStep; at: string }[] {
  return timelineSteps.flatMap((step) => (trip[step] ? [{ step, at: trip[step] as string }] : [])).sort((a, b) => a.at.localeCompare(b.at))
}

/** Whole-number percent of the fare taken as the platform fee, for display. */
export const feePercentOf = (trip: Pick<Trip, "fare" | "platformFee">) => (trip.fare ? Math.round((trip.platformFee / trip.fare) * 100) : 0)
