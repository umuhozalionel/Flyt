import { describe, expect, test } from "vitest"
import { formatMoney } from "@/lib/format"
import { placeDistances, placeIds, distanceBetween } from "@/lib/places"
import { distanceFare, fareSplit, FareError, quoteFare, sharedSeatFare } from "@/lib/pricing"
import type { PlanName, PricingConfig } from "@/lib/types"

// Every expected number below is worked out by hand in the comment next to it.
const config = (active: PlanName): PricingConfig => ({
  plans: [
    { name: "Baseline", firstKm: 1500, perKm: 1000, sharedSeatPercent: 40, isActive: active === "Baseline" },
    { name: "Test", firstKm: 1200, perKm: 750, sharedSeatPercent: 40, isActive: active === "Test" },
  ],
  airportZones: [{ placeId: "city-centre", price: 12000 }, { placeId: "remera" }, { placeId: "kicukiro", price: 9000 }],
})
const baseline = config("Baseline").plans[0]
const testPlan = config("Test").plans[1]
const rental = { hourlyRate: 12000, dailyRate: 40000 }

describe("distance fare", () => {
  test("Baseline", () => {
    expect(distanceFare(1, baseline)).toBe(1500) // first km only
    expect(distanceFare(5, baseline)).toBe(5500) // 1,500 + 4 × 1,000
    expect(distanceFare(8, baseline)).toBe(8500) // 1,500 + 7 × 1,000
    expect(distanceFare(0.5, baseline)).toBe(1500) // under 1 km pays the first km
    expect(distanceFare(4.5, baseline)).toBe(5000) // 1,500 + 3.5 × 1,000
  })
  test("Test", () => {
    expect(distanceFare(5, testPlan)).toBe(4200) // 1,200 + 4 × 750, the spec's example
    expect(distanceFare(1.5, testPlan)).toBe(1575) // 1,200 + 0.5 × 750
    expect(distanceFare(4.5, testPlan)).toBe(3825) // 1,200 + 3.5 × 750
    expect(distanceFare(10.5, testPlan)).toBe(8325) // 1,200 + 9.5 × 750
  })
})

describe("shared commute seat", () => {
  test("40% of the private fare", () => {
    expect(sharedSeatFare(8, baseline)).toBe(3400) // 8,500 × 40%
    expect(sharedSeatFare(5, testPlan)).toBe(1680) // 4,200 × 40%
    expect(sharedSeatFare(7.5, baseline)).toBe(3200) // (1,500 + 6.5 × 1,000) = 8,000 × 40%
    expect(sharedSeatFare(1.5, testPlan)).toBe(630) // 1,575 × 40% = 630
  })
})

describe("platform fee split", () => {
  test("12% of the fare", () => {
    expect(fareSplit(8500, 12)).toEqual({ fare: 8500, platformFee: 1020, firmKeeps: 7480 }) // 8,500 × 12% = 1,020
    expect(fareSplit(4200, 12)).toEqual({ fare: 4200, platformFee: 504, firmKeeps: 3696 }) // 4,200 × 12% = 504
    expect(fareSplit(3400, 12)).toEqual({ fare: 3400, platformFee: 408, firmKeeps: 2992 })
  })
  test("10% and 15%", () => {
    expect(fareSplit(4200, 10).platformFee).toBe(420)
    expect(fareSplit(4200, 15).platformFee).toBe(630)
  })
  test("rounds to whole Rwf", () => {
    expect(fareSplit(1575, 12)).toEqual({ fare: 1575, platformFee: 189, firmKeeps: 1386 }) // 189.0 exactly
    expect(fareSplit(3825, 12)).toEqual({ fare: 3825, platformFee: 459, firmKeeps: 3366 }) // 459.0
    expect(fareSplit(630, 15)).toEqual({ fare: 630, platformFee: 95, firmKeeps: 535 }) // 94.5 rounds up to 95
  })
})

describe("quotes from the distance table", () => {
  test("private", () => {
    expect(quoteFare({ type: "private", pickup: "kimihurura", dropoff: "kcc" }, config("Test"))).toMatchObject({ fare: 1575, distanceKm: 1.5, planName: "Test" })
    expect(quoteFare({ type: "private", pickup: "kcc", dropoff: "kimihurura" }, config("Baseline"))).toMatchObject({ fare: 2000, distanceKm: 1.5, planName: "Baseline" }) // 1,500 + 0.5 × 1,000
  })
  test("airport uses the zone for the other end", () => {
    expect(quoteFare({ type: "airport", pickup: "city-centre", dropoff: "airport" }, config("Baseline"))).toMatchObject({ fare: 12000, rule: "airport_zone" })
    expect(quoteFare({ type: "airport", pickup: "airport", dropoff: "kicukiro" }, config("Test"))).toMatchObject({ fare: 9000, rule: "airport_zone" })
  })
  test("airport falls back to the private formula when the zone has no price (audit bug 4)", () => {
    expect(quoteFare({ type: "airport", pickup: "remera", dropoff: "airport" }, config("Baseline"))).toMatchObject({ fare: 5500, distanceKm: 5, rule: "airport_fallback" }) // 1,500 + 4 × 1,000
    expect(quoteFare({ type: "airport", pickup: "remera", dropoff: "airport" }, config("Test"))).toMatchObject({ fare: 4200, rule: "airport_fallback" })
    expect(quoteFare({ type: "airport", pickup: "gisozi", dropoff: "airport" }, config("Test"))).toMatchObject({ fare: 10200, distanceKm: 13, rule: "airport_fallback" }) // 1,200 + 12 × 750
  })
  test("airport needs one end at the airport", () => {
    expect(() => quoteFare({ type: "airport", pickup: "remera", dropoff: "kcc" }, config("Test"))).toThrow(FareError)
  })
  test("hire uses the firm's own rate times the length (audit bug 5)", () => {
    expect(quoteFare({ type: "hourly", pickup: "kacyiru", dropoff: "kacyiru", hireQuantity: 3, firm: rental }, config("Test"))).toMatchObject({ fare: 36000, distanceKm: 0 }) // 12,000 × 3
    expect(quoteFare({ type: "daily", pickup: "remera", dropoff: "remera", hireQuantity: 2, firm: rental }, config("Baseline"))).toMatchObject({ fare: 80000 }) // 40,000 × 2
    expect(quoteFare({ type: "hourly", pickup: "kcc", dropoff: "kcc", hireQuantity: 2, firm: { hourlyRate: 15000 } }, config("Test")).fare).toBe(30000)
  })
  test("hire without a firm rate or with a bad length is refused", () => {
    expect(() => quoteFare({ type: "hourly", pickup: "kcc", dropoff: "kcc", hireQuantity: 2, firm: {} }, config("Test"))).toThrow(FareError)
    expect(() => quoteFare({ type: "daily", pickup: "kcc", dropoff: "kcc", hireQuantity: 0, firm: rental }, config("Test"))).toThrow(FareError)
    expect(() => quoteFare({ type: "daily", pickup: "kcc", dropoff: "kcc", hireQuantity: 1.5, firm: rental }, config("Test"))).toThrow(FareError)
  })
  test("shared commute", () => {
    expect(quoteFare({ type: "shared_commute", pickup: "remera", dropoff: "kcc" }, config("Test"))).toMatchObject({ fare: 1080, distanceKm: 3 }) // (1,200 + 2 × 750) = 2,700 × 40% = 1,080
  })
})

describe("distance table", () => {
  test("has all 45 pairs, both directions", () => {
    expect(placeDistances).toHaveLength(45)
    for (const a of placeIds) for (const b of placeIds) if (a !== b) expect(distanceBetween(a, b)).toBe(distanceBetween(b, a))
  })
})

describe("Rwf formatting", () => {
  test("no decimals, comma thousands", () => {
    expect(formatMoney(4200)).toBe("Rwf 4,200")
    expect(formatMoney(1234567)).toBe("Rwf 1,234,567")
    expect(formatMoney(4199.5)).toBe("Rwf 4,200")
  })
})
