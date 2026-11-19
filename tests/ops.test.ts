import { beforeEach, describe, expect, test } from "vitest"
import { __resetMockStore, mockSource as api } from "@/lib/data/mock"
import { normalizePlate } from "@/lib/fleet"
import { buildSeed } from "@/lib/mock-data"
import { documentAlerts, feesOwed, inScope, opsKpis, scopeFor, suggestDrivers, tripTimeline, unassignedRequests } from "@/lib/ops"
import type { FeeInvoice, Trip } from "@/lib/types"

// 12:00 in Kigali, so every "today" seed trip has happened.
const NOW = new Date("2026-11-19T10:00:00Z")
const TODAY = "2026-11-19"
const seed = () => buildSeed(NOW)

describe("overview figures", () => {
  test("KPIs for the seed, checked by hand", () => {
    const db = seed()
    const kpis = opsKpis(db.trips, db.drivers, TODAY)
    // Completed today on the Test plan (Rwf 1,200 first km + 750 per km):
    //   Kicukiro → KCC 5.5 km private: 1,200 + 4.5 × 750 = 4,575; fee 12% = 549
    //   Kicukiro → City Centre 7.5 km shared seat: (1,200 + 6.5 × 750) × 40% = 6,075 × 40% = 2,430; fee 12% = 291.6 → 292
    //   Remera → Kacyiru 5 km private: 1,200 + 4 × 750 = 4,200; fee 12% = 504
    expect(kpis).toEqual({
      activeTrips: 5, // 2 in progress, 1 driver arrived, 1 arriving, 1 assigned
      onlineDrivers: 9, // 5 on a trip + 4 online
      onTripDrivers: 5,
      waitingRequests: 2,
      scheduledRequests: 2,
      tripsToday: 3,
      faresToday: 11205, // 4,575 + 2,430 + 4,200
      feesToday: 1345, // 549 + 292 + 504
    })
  })

  test("document alerts: expired first, then missing, then soonest", () => {
    const db = seed()
    const alerts = documentAlerts(db.drivers, db.cars, db.firms, TODAY)
    expect(alerts.map((alert) => `${alert.ownerId}:${alert.docType}:${alert.status}:${alert.daysLeft ?? "-"}`)).toEqual([
      "driver-12:driving_licence:expired:-6",
      "car-12:inspection:expired:-3",
      "driver-6:criminal_record:missing:-",
      "car-4:inspection:expiring_soon:9",
      "driver-3:professional_certificate:expiring_soon:12",
      "driver-10:driving_licence:expiring_soon:20",
      "car-8:insurance:expiring_soon:25",
      "firm-3:rura_licence:expiring_soon:29",
    ])
  })

  test("unassigned: all requested trips, and scheduled ones only when due within the hour", () => {
    const db = seed()
    expect(unassignedRequests(db.trips, NOW).map((trip) => trip.status)).toEqual(["requested", "requested"])
    const scheduled = db.trips.find((trip) => trip.status === "scheduled")!
    const justBefore = new Date(Date.parse(scheduled.scheduledFor!) - 30 * 60_000)
    expect(unassignedRequests(db.trips, justBefore).map((trip) => trip.id)).toContain(scheduled.id)
  })
})

describe("dispatch suggestions", () => {
  test("only free, approved, online drivers with an available car, nearest first", () => {
    const db = seed()
    const trip = db.trips.find((item) => item.status === "requested" && item.type === "private")!
    const rows = suggestDrivers(trip, db.drivers, db.cars, db.firms)
    expect(rows).toHaveLength(3)
    for (const row of rows) expect(row.driver).toMatchObject({ status: "online", approval: "approved" })
    expect(rows.map((row) => row.km)).toEqual([...rows.map((row) => row.km)].sort((a, b) => a - b))
  })
  test("hire trips only suggest drivers of the booked firm", () => {
    const db = seed()
    const trip = db.trips.find((item) => item.type === "daily" && item.status === "scheduled")!
    const rows = suggestDrivers(trip, db.drivers, db.cars, db.firms)
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((row) => row.driver.firmId === trip.firmId)).toBe(true)
  })
  test("a firm admin only sees their own drivers", () => {
    const db = seed()
    const trip = db.trips.find((item) => item.status === "requested")!
    expect(suggestDrivers(trip, db.drivers, db.cars, db.firms, { firmId: "firm-2" }).every((row) => row.driver.firmId === "firm-2")).toBe(true)
  })
})

describe("scope and money", () => {
  test("firm admin scope keeps only that firm's rows", () => {
    const db = seed()
    const scope = scopeFor(db.admins.find((admin) => admin.id === "admin-3"))
    expect(scope).toEqual({ firmId: "firm-2" })
    expect(db.trips.filter(inScope(scope)).every((trip) => trip.firmId === "firm-2")).toBe(true)
    expect(scopeFor(db.admins[0])).toEqual({})
  })

  test("fees owed = unpaid invoices + this month's fees not invoiced yet", () => {
    const trip = (id: string, completedAt: string, fare: number, platformFee: number) => ({ id, firmId: "firm-1", status: "completed", completedAt, fare, platformFee }) as Trip
    const trips = [trip("a", "2026-11-03T08:00:00Z", 4200, 504), trip("b", "2026-11-10T08:00:00Z", 2700, 324), trip("c", "2026-10-20T08:00:00Z", 9000, 1080)]
    const invoices: FeeInvoice[] = [
      { id: "i1", firmId: "firm-1", period: "2026-10", tripCount: 1, faresTotal: 9000, feeTotal: 1080, status: "sent" },
      { id: "i2", firmId: "firm-1", period: "2026-09", tripCount: 1, faresTotal: 5000, feeTotal: 600, status: "paid" },
    ]
    // 1,080 unpaid + (504 + 324 = 828) this month = 1,908
    expect(feesOwed({ id: "firm-1" }, trips, invoices, NOW)).toEqual({ invoiced: 1080, thisMonth: 828, total: 1908 })
  })

  test("timeline is in time order and skips steps not reached", () => {
    const db = seed()
    const done = db.trips.find((item) => item.status === "completed" && item.paymentMethod === "momo")!
    const steps = tripTimeline(done)
    expect(steps[0].step).toBe("createdAt")
    expect(steps.map((step) => step.at)).toEqual([...steps.map((step) => step.at)].sort())
    expect(steps.some((step) => step.step === "cancelledAt")).toBe(false)
  })
})

describe("fleet writes", () => {
  beforeEach(() => __resetMockStore(seed()))

  test("add firm checks the TIN and fee", async () => {
    const base = { name: "Nyarutarama Cabs", type: "taxi" as const, ruraLicenceNo: "RURA/TX/2026/0500", licenceExpiry: "2027-12-31", tin: "123456789", momoMerchantCode: "*182*8*1*1#", airtelMerchantCode: "*500*4*2*1#", feePercent: 12 as const, status: "pending_licence" as const }
    await expect(api.addFirm({ ...base, tin: "12" })).rejects.toThrow("TIN")
    await expect(api.addFirm({ ...base, feePercent: 20 as never })).rejects.toThrow("10, 12 or 15")
    await expect(api.addFirm({ ...base, dailyRate: 40000.5 })).rejects.toThrow("whole Rwf")
    const firm = await api.addFirm(base)
    expect((await api.getFirms()).some((item) => item.id === firm.id)).toBe(true)
    await expect(api.addFirm(base)).rejects.toThrow("already exists")
  })

  test("new driver starts pending; blank documents are missing", async () => {
    const driver = await api.addDriver({ firmId: "firm-1", name: "Aimable Ndoli", phone: "0722 111 222", zone: "remera", documents: { driving_licence: "2028-01-31" } })
    expect(driver).toMatchObject({ approval: "pending", status: "offline", phone: "+250 722 111 222" })
    expect(driver.documents.find((doc) => doc.type === "driving_licence")).toMatchObject({ review: "on_file", expiryDate: "2028-01-31" })
    expect(driver.documents.find((doc) => doc.type === "criminal_record")?.review).toBe("missing")
    await expect(api.setDriverApproval(driver.id, "approved")).rejects.toThrow("missing")
    await expect(api.addDriver({ firmId: "firm-1", name: "Copy", phone: "+250 722 111 222", zone: "remera", documents: {} })).rejects.toThrow("already exists")
    await expect(api.addDriver({ firmId: "firm-1", name: "X", phone: "0788 999 999", zone: "remera", carId: "car-1", documents: {} })).rejects.toThrow("already has a driver")
  })

  test("suspend sets an online driver offline; a driver on a trip is suspended when the trip ends", async () => {
    const suspended = await api.setDriverApproval("driver-2", "suspended")
    expect(suspended).toMatchObject({ approval: "suspended", status: "offline" })
    const onTrip = await api.setDriverApproval("driver-5", "suspended") // driver-5 is driving an in-progress trip
    expect(onTrip).toMatchObject({ approval: "approved", status: "on_trip", suspendAfterTrip: true })
    const trip = (await api.getTrips()).find((item) => item.driverId === "driver-5" && item.status === "in_progress")!
    await api.endTrip(trip.id)
    const after = (await api.getDrivers()).find((item) => item.id === "driver-5")!
    expect(after).toMatchObject({ approval: "suspended", status: "offline" })
    expect(after.suspendAfterTrip).toBeUndefined()
    await expect(api.setDriverApproval("driver-6", "approved")).rejects.toThrow("missing") // criminal record missing in the seed
  })

  test("add car normalises the plate and refuses duplicates", async () => {
    expect(normalizePlate("rab123c")).toBe("RAB 123 C")
    expect(normalizePlate("AB 123 C")).toBeUndefined()
    const input = { firmId: "firm-2", plate: "rab 123c", make: "BYD", model: "Atto 3", colour: "White", year: 2025, seats: 4, power: "electric" as const, zone: "kcc" as const, documents: {} }
    const car = await api.addCar(input)
    expect(car).toMatchObject({ plate: "RAB 123 C", availability: "available" })
    expect(car.documents.map((doc) => doc.review)).toEqual(["missing", "missing", "missing"])
    await expect(api.addCar(input)).rejects.toThrow("already exists")
    await expect(api.addCar({ ...input, plate: "RAB 124 C", year: 1990 })).rejects.toThrow("Year")
  })
})
