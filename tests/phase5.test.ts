import { beforeEach, describe, expect, test } from "vitest"
import { __resetMockStore, mockSource as api } from "@/lib/data/mock"
import { companyMonth, companyTrips, isCompanyTrip, makeJoinCode } from "@/lib/company"
import { commuteRuns } from "@/lib/commute"
import { documentBlocks, documentStatus } from "@/lib/documents"
import { canInvoicePeriod, generateInvoices } from "@/lib/invoices"
import { buildSeed } from "@/lib/mock-data"
import { pilotReport, planPeriods, repeatRiders } from "@/lib/report"
import type { CommuteRoute, FeeInvoice, Trip } from "@/lib/types"

// 12:00 in Kigali on 19 Nov 2026. The pilot started 33 days earlier (17 Oct); Test prices from day 28 (14 Nov).
const NOW = new Date("2026-11-19T10:00:00Z")
const seed = () => buildSeed(NOW)

/** Kigali month of a UTC time, worked out by hand (UTC+2, no daylight saving) so it doesn't reuse lib/time. */
const kigaliMonthByHand = (iso: string) => new Date(Date.parse(iso) + 2 * 3_600_000).toISOString().slice(0, 7)

describe("invoices", () => {
  const trip = (id: string, firmId: string, completedAt: string, fare: number, platformFee: number, extra: Partial<Trip> = {}) => ({ id, firmId, status: "completed", completedAt, fare, platformFee, paymentMethod: "momo", type: "private", ...extra }) as Trip

  test("generate: drafts for firms and companies with trips; drafts refresh; sent ones never change", () => {
    const trips = [
      trip("a", "f1", "2026-11-03T08:00:00Z", 4200, 504),
      trip("b", "f1", "2026-11-30T22:30:00Z", 2700, 324), // 00:30 on 1 Dec in Kigali: December
      trip("c", "f2", "2026-11-10T08:00:00Z", 9000, 1080, { companyId: "co1", paymentMethod: "company_account" }),
      trip("d", "f3", "2026-11-11T08:00:00Z", 5000, 600), // pending firm: no invoice
      trip("e", "f1", "2026-11-12T08:00:00Z", 3000, 360, { companyId: "co1" }), // MoMo ride: not on the company invoice
    ]
    const firms = [{ id: "f1", status: "active" as const }, { id: "f2", status: "active" as const }, { id: "f3", status: "pending_licence" as const }]
    const sent: FeeInvoice = { id: "FI-old", firmId: "f2", period: "2026-11", tripCount: 0, faresTotal: 0, feeTotal: 0, status: "sent", lines: [], adjustments: [] }
    const first = generateInvoices("2026-11", firms, [{ id: "co1" }, { id: "co2" }], trips, [sent], [])
    // f1: trips a + e = 4,200 + 3,000 = 7,200 fares; fees 504 + 360 = 864. Trip b is December.
    expect(first.feeInvoices.find((invoice) => invoice.firmId === "f1")).toMatchObject({ tripCount: 2, faresTotal: 7200, feeTotal: 864, status: "draft" })
    // f2 already has a sent invoice for November: left as it was.
    expect(first.feeInvoices.find((invoice) => invoice.firmId === "f2")).toEqual(sent)
    expect(first.feeInvoices.some((invoice) => invoice.firmId === "f3")).toBe(false)
    // co1 pays only for trip c (company account): 9,000. co2 has no trips: no invoice.
    expect(first.companyInvoices).toMatchObject([{ id: "CI-2026-11-co1", companyId: "co1", period: "2026-11", tripCount: 1, total: 9000, status: "draft" }])
    expect(first).toMatchObject({ created: 2, refreshed: 0 })

    const more = [...trips, trip("f", "f1", "2026-11-20T08:00:00Z", 1950, 234)]
    const second = generateInvoices("2026-11", firms, [{ id: "co1" }], more, first.feeInvoices, first.companyInvoices)
    // 7,200 + 1,950 = 9,150; 864 + 234 = 1,098
    expect(second.feeInvoices.find((invoice) => invoice.firmId === "f1")).toMatchObject({ tripCount: 3, faresTotal: 9150, feeTotal: 1098, status: "draft" })
    expect(second).toMatchObject({ created: 0, refreshed: 2 })
  })

  test("only this month or earlier can be invoiced", () => {
    expect(canInvoicePeriod("2026-11", NOW)).toBe(true)
    expect(canInvoicePeriod("2026-10", NOW)).toBe(true)
    expect(canInvoicePeriod("2026-12", NOW)).toBe(false)
    expect(canInvoicePeriod("2026-13", NOW)).toBe(false)
  })

  test("seed: November drafts match a plain loop over the trips, and the fees owed shown in Ops", () => {
    const db = seed()
    const result = generateInvoices("2026-11", db.firms, db.companies, db.trips, db.feeInvoices, db.companyInvoices)
    for (const firm of db.firms.filter((item) => item.status === "active")) {
      let count = 0
      let fares = 0
      let fees = 0
      for (const t of db.trips) {
        if (t.firmId === firm.id && t.status === "completed" && t.completedAt && kigaliMonthByHand(t.completedAt) === "2026-11") {
          count++
          fares += t.fare
          fees += t.platformFee
        }
      }
      expect(result.feeInvoices.find((invoice) => invoice.firmId === firm.id && invoice.period === "2026-11")).toMatchObject({ tripCount: count, faresTotal: fares, feeTotal: fees })
    }
    // Checked against the Phase 3 "fees owed, this month" figures: City Cabs 3,619 and Imena 12,512.
    expect(result.feeInvoices.filter((invoice) => invoice.period === "2026-11").map((invoice) => [invoice.firmId, invoice.tripCount, invoice.faresTotal, invoice.feeTotal])).toEqual([
      ["firm-1", 8, 30155, 3619],
      ["firm-2", 9, 104260, 12512],
    ])
    expect(result.companyInvoices.filter((invoice) => invoice.period === "2026-11").map((invoice) => [invoice.companyId, invoice.tripCount, invoice.total])).toEqual([
      ["co-1", 2, 2480],
      ["co-2", 2, 4860],
      ["co-3", 1, 8500],
      ["co-4", 1, 4200],
    ])
  })
})

describe("pilot report", () => {
  test("seed figures, Baseline against Test, checked with a plain loop", () => {
    const db = seed()
    const report = pilotReport({ trips: db.trips, carIds: db.cars.map((car) => car.id), routes: db.commuteRoutes, incidents: db.incidents, today: "2026-11-19" })
    expect(report.periods).toEqual([
      { plan: "Baseline", from: "2026-10-17", to: "2026-11-13", days: 28 },
      { plan: "Test", from: "2026-11-14", to: "2026-11-19", days: 6 },
    ])
    for (const figures of report.plans) {
      const rows = db.trips.filter((t) => t.planName === figures.period.plan)
      let completed = 0
      let fares = 0
      let cancelled = 0
      let receipts = 0
      for (const t of rows) {
        if (t.status === "completed") {
          completed++
          fares += t.fare
          if (t.receiptNo) receipts++
        }
        if (t.status === "cancelled_by_rider" || t.status === "cancelled_by_driver" || t.status === "no_driver_found") cancelled++
      }
      const carDays = 12 * figures.period.days
      expect(figures).toMatchObject({ booked: rows.length, completed, fares, cancelled, receipts })
      expect(figures.faresPerCarPerDay).toBe(Math.round(fares / carDays))
      expect(figures.tripsPerCarPerDay).toBe(Math.round((completed / carDays) * 100) / 100)
    }
    // By hand:
    // Baseline: 14 completed, Rwf 188,000 over 12 cars × 28 days = 336 car-days → 188,000 ÷ 336 = 559.5 → 560; 14 ÷ 336 = 0.04.
    //   3 cancelled of 17 finished → 17.6%. Rider 1 booked twice 14 days apart: 1 of 16 riders repeat → 6.3%.
    // Test: 12 completed, Rwf 104,015 over 72 car-days → 1,444.65 → 1,445; 12 ÷ 72 = 0.17.
    //   2 cancelled of 14 finished → 14.3%. 1 of 22 riders repeat → 4.5%.
    // Waits (booking to driver arrived): Baseline 6+8+11+7+9+5+10+14+7+6+16+8+6+8 = 121 over 14 trips → 8.64 → 8.6 min.
    //   Test 11+7+13+5+10+14+12+6+9+16+8+6+8+11+7 = 143 over 15 trips (3 still active today) → 9.53 → 9.5 min.
    const [baseline, testPlan] = report.plans
    expect(baseline).toMatchObject({ completed: 14, fares: 188000, faresPerCarPerDay: 560, tripsPerCarPerDay: 0.04, cancellationPercent: 17.6, riders: 16, repeatRiders: 1, repeatPercent: 6.3, receipts: 14, sharedRuns: 3, seatsPerSharedTrip: 1, avgWaitMinutes: 8.6, incidents: 2 })
    expect(testPlan).toMatchObject({ completed: 12, fares: 104015, faresPerCarPerDay: 1445, tripsPerCarPerDay: 0.17, cancellationPercent: 14.3, riders: 22, repeatRiders: 1, repeatPercent: 4.5, receipts: 12, sharedRuns: 3, seatsPerSharedTrip: 1, avgWaitMinutes: 9.5, incidents: 1 })
    // The chart has one bar per pilot day.
    expect(report.daily).toHaveLength(34)
  })

  test("repeat riders: a second booking more than 30 days later does not count", () => {
    const t = (riderId: string, createdAt: string) => ({ riderId, createdAt }) as Trip
    expect(repeatRiders([t("a", "2026-10-01T08:00:00Z"), t("a", "2026-10-31T08:00:00Z"), t("b", "2026-10-01T08:00:00Z"), t("b", "2026-11-02T08:00:00Z"), t("c", "2026-10-05T08:00:00Z")])).toEqual({ riders: 3, repeat: 1 })
  })

  test("plan periods: one plan only runs to today", () => {
    expect(planPeriods([{ planName: "Test", createdAt: "2026-11-10T08:00:00Z" } as Trip], "2026-11-19")).toEqual([{ plan: "Test", from: "2026-11-10", to: "2026-11-19", days: 10 }])
  })

  test("shared commute runs group seats by day and nearest departure", () => {
    const route: CommuteRoute = { id: "r", companyId: "co", name: "R", stops: ["remera", "kcc"], departureTimes: ["07:15", "17:30"], seatsPerCar: 3, riderIds: [] }
    const seat = (id: string, createdAt: string, status: Trip["status"] = "completed") => ({ id, type: "shared_commute", commuteRouteId: "r", createdAt, status }) as Trip
    const runs = commuteRuns(route, [seat("1", "2026-11-18T05:05:00Z"), seat("2", "2026-11-18T05:20:00Z"), seat("3", "2026-11-18T15:20:00Z"), seat("4", "2026-11-18T05:10:00Z", "cancelled_by_rider")])
    // 07:05 and 07:20 Kigali → the 07:15 run (2 seats); 17:20 → the 17:30 run; the cancelled seat is left out.
    expect(runs.map((run) => [run.day, run.departure, run.seatsFilled])).toEqual([
      ["2026-11-18", "17:30", 1],
      ["2026-11-18", "07:15", 2],
    ])
  })
})

describe("company visibility (rule b)", () => {
  test("only company-billed trips and shared seats; never staff's own MoMo rides", () => {
    const db = seed()
    const rows = companyTrips(db.trips, "co-1")
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((trip) => trip.companyId === "co-1" && (trip.paymentMethod === "company_account" || trip.type === "shared_commute"))).toBe(true)
    // Rider 1 (Akagera staff) has MoMo rides in the seed; none show.
    const momo = db.trips.filter((trip) => trip.riderId === "rider-1" && trip.paymentMethod === "momo")
    expect(momo.length).toBeGreaterThan(0)
    expect(momo.some((trip) => isCompanyTrip(trip, "co-1"))).toBe(false)
    // November so far for Akagera: the same 2 trips and Rwf 2,480 as its draft invoice.
    expect(companyMonth(db.trips, "co-1", "2026-11")).toEqual({ trips: 2, spend: 2480 })
  })

  test("join codes come from the name and avoid codes in use", () => {
    const fixed = () => 0.5 // 10 + floor(0.5 × 90) = 55
    expect(makeJoinCode("Nyarutarama Health", [], fixed)).toBe("NYARUTARAM-55")
    expect(makeJoinCode("Akagera Group", ["AKAGERA-55"], (() => { let i = 0; return () => [0.5, 0.1][i++ % 2] })())).toBe("AKAGERA-19")
  })
})

describe("Phase 5 writes", () => {
  beforeEach(() => __resetMockStore(seed()))

  test("document review: platform admins only; a rejection needs a reason and blocks the driver", async () => {
    const pending = { owner: "driver" as const, ownerId: "driver-11", type: "criminal_record" as const }
    await expect(api.reviewDocument({ ...pending, adminId: "admin-3", decision: "approve" })).rejects.toThrow("Only platform admins")
    await expect(api.reviewDocument({ ...pending, adminId: "admin-1", decision: "reject", reason: " " })).rejects.toThrow("reason")
    const doc = await api.reviewDocument({ ...pending, adminId: "admin-1", decision: "reject", reason: "Photo is unreadable" })
    expect(doc).toMatchObject({ review: "rejected", rejectReason: "Photo is unreadable" })
    expect(documentStatus(doc)).toBe("rejected")
    expect(documentBlocks(doc)).toBe(true)
    await expect(api.setDriverPresence("driver-11", "online")).rejects.toThrow("expired, missing or rejected")
    await expect(api.reviewDocument({ ...pending, adminId: "admin-1", decision: "approve" })).rejects.toThrow("not waiting for review")
    // The driver sends a new one: the reason is cleared and it is in review again; then it is approved.
    const driver = await api.submitDocument("driver-11", "criminal_record", "2027-06-30")
    expect(driver.documents.find((item) => item.type === "criminal_record")).toMatchObject({ review: "pending_review", rejectReason: undefined })
    expect(await api.reviewDocument({ ...pending, adminId: "admin-1", decision: "approve" })).toMatchObject({ review: "on_file", expiryDate: "2027-06-30" })
    expect(await api.setDriverPresence("driver-11", "online")).toMatchObject({ status: "online" })
  })

  test("rejecting a document of an online driver takes them offline", async () => {
    await api.submitDocument("driver-2", "driving_licence", "2029-01-31") // driver-2 is online in the seed
    await api.reviewDocument({ adminId: "admin-1", owner: "driver", ownerId: "driver-2", type: "driving_licence", decision: "reject", reason: "Wrong document" })
    expect((await api.getDrivers()).find((item) => item.id === "driver-2")).toMatchObject({ status: "offline" })
  })

  test("company: add, staff add by phone, remove unlinks from routes", async () => {
    const company = await api.addCompany({ name: "Nyarutarama Health", contactName: "Alice Uwera", phone: "0788 555 100", staffCount: 30, status: "active" })
    expect(company.joinCode).toMatch(/^NYARUTARAM-\d{2}$/)
    expect(company.phone).toBe("+250 788 555 100")
    await expect(api.addCompany({ name: "nyarutarama health", contactName: "X", phone: "0788 555 101", staffCount: 3, status: "active" })).rejects.toThrow("already exists")
    await expect(api.addCompany({ name: "Other", contactName: "X", phone: "0788 555 101", staffCount: 3, status: "active", joinCode: "akagera-24" })).rejects.toThrow("already used")
    // Rider 13 has a personal account: linked by phone. A new number creates a rider who must accept the Terms on first sign-in.
    const linked = await api.addStaff(company.id, { name: "", phone: "0788 410 313" })
    expect(linked).toMatchObject({ id: "rider-13", companyId: company.id })
    await expect(api.addStaff(company.id, { name: "", phone: "0788 410 301" })).rejects.toThrow("another company")
    const created = await api.addStaff(company.id, { name: "Eric Mugisha", phone: "0722 900 900" })
    expect(created).toMatchObject({ companyId: company.id, consentAt: undefined })
    await expect(api.signInRider({ phone: "0722 900 900", consent: false })).rejects.toThrow("Accept the Terms")
    expect((await api.signInRider({ phone: "0722 900 900", consent: true })).consentAt).toBeTruthy()
    // Removing rider 1 from Akagera also takes them off route 1.
    await api.removeStaff("co-1", "rider-1")
    expect((await api.getCommuteRoutes()).find((route) => route.id === "route-1")!.riderIds).toEqual(["rider-2", "rider-3"])
    await expect(api.removeStaff("co-1", "rider-1")).rejects.toThrow("not on your staff")
  })

  test("invoices move draft → sent → paid only", async () => {
    const run = await api.generateInvoices("2026-11")
    expect(run).toMatchObject({ period: "2026-11", created: 6, refreshed: 0 })
    await expect(api.generateInvoices("2099-01")).rejects.toThrow("this month or an earlier")
    const draft = (await api.getFeeInvoices()).find((invoice) => invoice.period === "2026-11" && invoice.firmId === "firm-1")!
    await expect(api.setInvoiceStatus("fee", draft.id, "paid")).rejects.toThrow("draft to sent to paid")
    expect(await api.setInvoiceStatus("fee", draft.id, "sent")).toMatchObject({ status: "sent" })
    expect(await api.setInvoiceStatus("fee", draft.id, "paid")).toMatchObject({ status: "paid" })
    await expect(api.setInvoiceStatus("fee", draft.id, "draft")).rejects.toThrow()
  })

  test("incidents take notes and status changes", async () => {
    await expect(api.updateIncident("INC-302", {})).rejects.toThrow("note or change")
    const incident = await api.updateIncident("INC-302", { note: "Called the rider; they are safe.", status: "investigating" })
    expect(incident).toMatchObject({ status: "investigating", notes: ["Called the rider; they are safe."] })
  })

  test("team: add members by role; platform admins only remove; never yourself or the last platform admin", async () => {
    await expect(api.addAdmin({ name: "X", phone: "0788 200 010", role: "firm_admin" })).rejects.toThrow("Pick the firm")
    const member = await api.addAdmin({ name: "Diane Keza", phone: "0788 200 010", role: "company_admin", companyId: "co-3" })
    expect(member).toMatchObject({ role: "company_admin", companyId: "co-3", firmId: undefined })
    await expect(api.removeAdmin(member.id, "admin-2")).rejects.toThrow("Only platform admins")
    await expect(api.removeAdmin("admin-1", "admin-1")).rejects.toThrow("yourself")
    const other = await api.addAdmin({ name: "Paul Ishimwe", phone: "0788 200 011", role: "platform_admin" })
    await api.removeAdmin("admin-1", other.id)
    await expect(api.removeAdmin(other.id, other.id)).rejects.toThrow("yourself")
    await api.removeAdmin(member.id, other.id)
    expect((await api.getAdmins()).some((admin) => admin.id === member.id)).toBe(false)
  })
})
