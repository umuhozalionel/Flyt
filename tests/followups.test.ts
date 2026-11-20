import { beforeEach, describe, expect, test } from "vitest"
import { __resetMockStore, mockSource as api } from "@/lib/data/mock"
import { generateInvoices } from "@/lib/invoices"
import { buildSeed } from "@/lib/mock-data"
import type { FeeInvoice, Trip } from "@/lib/types"

// Phase 5 follow-ups: invoice adjustment lines after a fare correction, and firm hire rates.

const trip = (id: string, completedAt: string, fare: number, platformFee: number, extra: Partial<Trip> = {}) =>
  ({ id, firmId: "f1", status: "completed", completedAt, fare, platformFee, paymentMethod: "company_account", companyId: "co1", type: "private", ...extra }) as Trip
const firms = [{ id: "f1", status: "active" as const }]
const companies = [{ id: "co1" }]

describe("invoice adjustment lines", () => {
  test("a correction after the invoice is sent goes on the next invoice; sent invoices never change", () => {
    // October: trip a, Rwf 9,000, fee 12% = 1,080. Sent.
    const a = trip("a", "2026-10-20T08:00:00Z", 9000, 1080)
    const october = generateInvoices("2026-10", firms, companies, [a], [], [])
    const sentFees: FeeInvoice[] = october.feeInvoices.map((invoice) => ({ ...invoice, status: "sent" }))
    const sentBills = october.companyInvoices.map((invoice) => ({ ...invoice, status: "sent" as const }))
    expect(sentFees[0]).toMatchObject({ tripCount: 1, faresTotal: 9000, feeTotal: 1080 })

    // Trip a corrected to Rwf 7,000: fee 12% = 840. Trip b in November: 4,200, fee 504.
    const corrected = { ...a, fare: 7000, platformFee: 840, corrections: [{ at: "2026-11-02T08:00:00Z", byAdminId: "admin-1", fromFare: 9000, toFare: 7000, reason: "Wrong drop-off", feePercent: 12 }] }
    const b = trip("b", "2026-11-03T08:00:00Z", 4200, 504)
    const november = generateInvoices("2026-11", firms, companies, [corrected, b], sentFees, sentBills)
    const octoberAfter = november.feeInvoices.find((invoice) => invoice.period === "2026-10")!
    expect(octoberAfter).toEqual(sentFees[0])
    const fee = november.feeInvoices.find((invoice) => invoice.period === "2026-11")!
    // By hand: lines 4,200 / 504. Adjustment 7,000 − 9,000 = −2,000 fares, 840 − 1,080 = −240 fee.
    // Totals 4,200 − 2,000 = 2,200 fares; 504 − 240 = 264 fee.
    expect(fee.adjustments).toEqual([{ tripId: "a", fromPeriod: "2026-10", fare: -2000, fee: -240, reason: "Wrong drop-off" }])
    expect(fee).toMatchObject({ tripCount: 1, faresTotal: 2200, feeTotal: 264, status: "draft" })
    const bill = november.companyInvoices.find((invoice) => invoice.period === "2026-11")!
    expect(bill).toMatchObject({ tripCount: 1, total: 2200 })

    // Refreshing the November draft does not add the adjustment twice.
    const again = generateInvoices("2026-11", firms, companies, [corrected, b], november.feeInvoices, november.companyInvoices)
    expect(again.feeInvoices.find((invoice) => invoice.period === "2026-11")).toMatchObject({ faresTotal: 2200, feeTotal: 264 })
    expect(again.feeInvoices.find((invoice) => invoice.period === "2026-11")!.adjustments).toHaveLength(1)

    // November sent. Then trip a is voided (Rwf 0): December gets −7,000 fares, −840 fee, even with no December trips.
    const novSent = again.feeInvoices.map((invoice) => ({ ...invoice, status: "sent" as const }))
    const voided = { ...corrected, fare: 0, platformFee: 0, corrections: [...corrected.corrections, { at: "2026-12-01T08:00:00Z", byAdminId: "admin-1", fromFare: 7000, toFare: 0, reason: "Trip did not happen", feePercent: 12 }] }
    const december = generateInvoices("2026-12", firms, [], [voided, b], novSent, [])
    expect(december.feeInvoices.find((invoice) => invoice.period === "2026-12")).toMatchObject({ tripCount: 0, faresTotal: -7000, feeTotal: -840, adjustments: [{ tripId: "a", fromPeriod: "2026-10", fare: -7000, fee: -840, reason: "Trip did not happen" }] })
    // Check: 9,000 − 2,000 − 7,000 = 0 billed in all for trip a.
    expect(december.feeInvoices.every((invoice) => invoice.period !== "2026-11" || invoice.faresTotal === 2200)).toBe(true)
  })

  test("a correction while the invoice is still a draft just refreshes that draft", () => {
    const a = trip("a", "2026-10-20T08:00:00Z", 9000, 1080)
    const october = generateInvoices("2026-10", firms, [], [a], [], [])
    const corrected = { ...a, fare: 0, platformFee: 0 }
    const refreshed = generateInvoices("2026-10", firms, [], [corrected], october.feeInvoices, [])
    // A voided trip is not billed.
    expect(refreshed.feeInvoices[0]).toMatchObject({ tripCount: 0, faresTotal: 0, feeTotal: 0, lines: [], adjustments: [] })
    const november = generateInvoices("2026-11", firms, [], [corrected], refreshed.feeInvoices, [])
    expect(november.created).toBe(0)
  })
})

describe("fare corrections and firm rates (mock adapter)", () => {
  beforeEach(() => __resetMockStore(buildSeed(new Date("2026-11-19T08:00:00Z"))))

  test("only platform admins correct, only completed trips, fee follows at the trip's rate", async () => {
    const done = (await api.getTrips()).find((item) => item.status === "completed" && item.firmId === "firm-1")!
    await expect(api.correctTripFare({ adminId: "admin-2", tripId: done.id, fare: 1000, reason: "x" })).rejects.toThrow("Only platform admins")
    const active = (await api.getTrips()).find((item) => item.status === "in_progress")!
    await expect(api.correctTripFare({ adminId: "admin-1", tripId: active.id, fare: 1000, reason: "x" })).rejects.toThrow("completed")
    await expect(api.correctTripFare({ adminId: "admin-1", tripId: done.id, fare: 1000.5, reason: "x" })).rejects.toThrow("whole Rwf")
    await expect(api.correctTripFare({ adminId: "admin-1", tripId: done.id, fare: 1000, reason: " " })).rejects.toThrow("reason")
    // 5,000 at 12% → fee 600. Void → 0. Back to 3,000 → 360 (the rate is kept from the first correction).
    expect(await api.correctTripFare({ adminId: "admin-1", tripId: done.id, fare: 5000, reason: "Agreed price" })).toMatchObject({ fare: 5000, platformFee: 600 })
    expect(await api.correctTripFare({ adminId: "admin-1", tripId: done.id, fare: 0, reason: "Void" })).toMatchObject({ fare: 0, platformFee: 0 })
    const last = await api.correctTripFare({ adminId: "admin-1", tripId: done.id, fare: 3000, reason: "Partial" })
    expect(last).toMatchObject({ fare: 3000, platformFee: 360 })
    expect(last.corrections!.map((item) => [item.fromFare, item.toFare])).toEqual([[done.fare, 5000], [5000, 0], [0, 3000]])
  })

  test("firm hire rates: whole Rwf, blank means not offered, new bookings use the new rate", async () => {
    await expect(api.setFirmRates("firm-2", { hourlyRate: 12500.5, dailyRate: 40000 })).rejects.toThrow("whole Rwf")
    expect(await api.setFirmRates("firm-2", { hourlyRate: 13000, dailyRate: undefined })).toMatchObject({ hourlyRate: 13000, dailyRate: undefined })
    // 2 hours × 13,000 = 26,000.
    expect((await api.quoteTrip({ type: "hourly", pickup: "kacyiru", dropoff: "kacyiru", hireQuantity: 2 })).fare).toBe(26000)
    // No active firm offers daily hire now (firm-3 is pending its licence).
    await expect(api.quoteTrip({ type: "daily", pickup: "kacyiru", dropoff: "kacyiru", hireQuantity: 1 })).rejects.toThrow("No licensed partner")
  })
})
