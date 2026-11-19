import { describe, expect, test } from "vitest"
import { documentStatus } from "@/lib/documents"
import { companyInvoiceFor, feeInvoiceFor } from "@/lib/invoices"
import { buildSeed, PILOT_DAY } from "@/lib/mock-data"
import { fareSplit, quoteFare } from "@/lib/pricing"
import { kigaliMonth } from "@/lib/time"
import { activeStatuses } from "@/lib/trip-rules"
import type { PlanName, TripStatus, TripType } from "@/lib/types"

const now = new Date("2026-11-19T15:00:00Z")
const seed = buildSeed(now)
const configFor = (name: PlanName) => ({ ...seed.pricing, plans: seed.pricing.plans.map((plan) => ({ ...plan, isActive: plan.name === name })) })

describe("seed counts match the spec", () => {
  test("counts", () => {
    expect(seed.firms).toHaveLength(3)
    expect(seed.firms.filter((firm) => firm.status === "pending_licence")).toHaveLength(1)
    expect(seed.cars).toHaveLength(12)
    expect(seed.cars.some((car) => car.power === "electric") && seed.cars.some((car) => car.power === "fuel")).toBe(true)
    expect(seed.drivers).toHaveLength(12)
    expect(seed.trips).toHaveLength(40)
    expect(seed.companies).toHaveLength(4)
    expect(seed.commuteRoutes).toHaveLength(2)
    expect(seed.riders).toHaveLength(30)
    expect(seed.incidents).toHaveLength(3)
  })
  test("all 10 trip statuses and all 5 ride types", () => {
    const statuses: TripStatus[] = ["requested", "scheduled", "assigned", "driver_arriving", "driver_arrived", "in_progress", "completed", "cancelled_by_rider", "cancelled_by_driver", "no_driver_found"]
    const types: TripType[] = ["private", "shared_commute", "hourly", "daily", "airport"]
    for (const status of statuses) expect(seed.trips.some((trip) => trip.status === status), status).toBe(true)
    for (const type of types) expect(seed.trips.some((trip) => trip.type === type), type).toBe(true)
  })
  test("both Baseline and Test trips, Test active in week 5", () => {
    expect(seed.trips.filter((trip) => trip.planName === "Baseline").length).toBeGreaterThan(10)
    expect(seed.trips.filter((trip) => trip.planName === "Test").length).toBeGreaterThan(10)
    expect(seed.pricing.plans.find((plan) => plan.isActive)?.name).toBe("Test")
    expect(PILOT_DAY).toBe(33)
  })
  test("company staff spread over all four companies", () => {
    for (const company of seed.companies) expect(seed.riders.filter((rider) => rider.companyId === company.id).length, company.id).toBe(3)
  })
})

describe("every seed fare comes from the fare engine (audit item 8)", () => {
  test.each(seed.trips.map((trip) => [trip.id, trip] as const))("%s", (_id, trip) => {
    const firm = seed.firms.find((item) => item.id === trip.firmId)!
    const quote = quoteFare({ type: trip.type, pickup: trip.pickup, dropoff: trip.dropoff, hireQuantity: trip.hireQuantity, firm }, configFor(trip.planName))
    expect(trip.fare).toBe(quote.fare)
    expect(trip.distanceKm).toBe(quote.distanceKm)
    expect(trip.platformFee).toBe(fareSplit(trip.fare, firm.feePercent).platformFee)
    expect(Number.isInteger(trip.fare) && Number.isInteger(trip.platformFee)).toBe(true)
  })
})

describe("business rules in the seed", () => {
  test("shared commute trips belong to a company route and are billed to the company", () => {
    const shared = seed.trips.filter((trip) => trip.type === "shared_commute")
    expect(shared.length).toBeGreaterThan(0)
    for (const trip of shared) {
      const rider = seed.riders.find((item) => item.id === trip.riderId)!
      const route = seed.commuteRoutes.find((item) => item.id === trip.commuteRouteId)!
      expect(trip.paymentMethod).toBe("company_account")
      expect(trip.companyId).toBe(rider.companyId)
      expect(route.companyId).toBe(rider.companyId)
      expect(route.riderIds).toContain(rider.id)
    }
  })
  test("company billing only for company staff", () => {
    for (const trip of seed.trips.filter((item) => item.paymentMethod === "company_account")) {
      expect(seed.riders.find((rider) => rider.id === trip.riderId)?.companyId).toBe(trip.companyId)
      expect(trip.paymentStatus).toBe("billed_to_company")
    }
  })
  test("hire trips run with a firm that sets that rate", () => {
    for (const trip of seed.trips.filter((item) => item.type === "hourly" || item.type === "daily")) {
      const firm = seed.firms.find((item) => item.id === trip.firmId)!
      expect(trip.type === "hourly" ? firm.hourlyRate : firm.dailyRate).toBeDefined()
      expect(trip.hireQuantity).toBeGreaterThanOrEqual(1)
    }
  })
  test("drivers and cars on a trip belong to the trip's firm; one active trip per driver", () => {
    for (const trip of seed.trips.filter((item) => item.driverId)) {
      const driver = seed.drivers.find((item) => item.id === trip.driverId)!
      expect(driver.firmId).toBe(trip.firmId)
      expect(trip.carId).toBe(driver.carId)
      expect(driver.approval).toBe("approved")
    }
    const active = seed.trips.filter((trip) => activeStatuses.includes(trip.status))
    expect(new Set(active.map((trip) => trip.driverId)).size).toBe(active.length)
    for (const driver of seed.drivers) {
      const busy = active.some((trip) => trip.driverId === driver.id)
      expect(driver.status === "on_trip").toBe(busy)
      expect(seed.cars.find((car) => car.id === driver.carId)?.availability === "in_use").toBe(busy)
    }
  })
  test("completed trips have a receipt and a full timeline", () => {
    for (const trip of seed.trips.filter((item) => item.status === "completed")) {
      expect(trip.receiptNo).toMatch(/^EBM-\d{4}-\d{5}$/)
      expect(trip.assignedAt && trip.acceptedAt && trip.arrivedAt && trip.startedAt && trip.completedAt).toBeTruthy()
      expect(trip.createdAt <= trip.assignedAt! && trip.assignedAt! <= trip.startedAt! && trip.startedAt! <= trip.completedAt!).toBe(true)
    }
  })
  test("cancelled trips record who and why", () => {
    for (const trip of seed.trips.filter((item) => item.status.startsWith("cancelled") || item.status === "no_driver_found")) {
      expect(trip.cancelledAt).toBeDefined()
      expect(trip.cancelledBy).toBeDefined()
      expect(trip.cancelReason).toBeTruthy()
    }
  })
  test("the demo rider starts with no active trip", () => {
    expect(seed.trips.some((trip) => trip.riderId === "rider-1" && activeStatuses.includes(trip.status))).toBe(false)
  })
})

describe("documents use their expiry date (audit item 8)", () => {
  const today = "2026-11-19"
  const statuses = [...seed.drivers, ...seed.cars].flatMap((owner) => owner.documents.map((doc) => documentStatus(doc, today)))
  test("a mix of statuses for Ops alerts", () => {
    for (const status of ["valid", "expiring_soon", "expired", "missing", "pending_review"] as const) expect(statuses).toContain(status)
  })
  test("each driver has all four driver documents including criminal record", () => {
    for (const driver of seed.drivers) expect(driver.documents.map((doc) => doc.type).sort()).toEqual(["criminal_record", "driving_licence", "national_id", "professional_certificate"])
  })
  test("thresholds", () => {
    expect(documentStatus({ review: "on_file", expiryDate: "2026-12-19" }, today)).toBe("expiring_soon") // 30 days left
    expect(documentStatus({ review: "on_file", expiryDate: "2026-12-20" }, today)).toBe("valid") // 31 days left
    expect(documentStatus({ review: "on_file", expiryDate: "2026-11-19" }, today)).toBe("expiring_soon") // expires today
    expect(documentStatus({ review: "on_file", expiryDate: "2026-11-18" }, today)).toBe("expired")
  })
})

describe("seed invoices add up", () => {
  test("fee invoices equal the sum of completed trips for the period", () => {
    for (const invoice of seed.feeInvoices) {
      const firm = seed.firms.find((item) => item.id === invoice.firmId)!
      expect(invoice).toMatchObject(feeInvoiceFor(firm, seed.trips, invoice.period))
      const rows = seed.trips.filter((trip) => trip.firmId === firm.id && trip.status === "completed" && kigaliMonth(trip.completedAt!) === invoice.period)
      expect(invoice.feeTotal).toBe(rows.reduce((sum, trip) => sum + Math.round((trip.fare * firm.feePercent) / 100), 0))
    }
    expect(seed.feeInvoices.some((invoice) => invoice.tripCount > 0)).toBe(true)
  })
  test("company invoices count only trips billed to the company", () => {
    for (const invoice of seed.companyInvoices) expect(invoice).toMatchObject(companyInvoiceFor(invoice.companyId, seed.trips, invoice.period))
  })
})
