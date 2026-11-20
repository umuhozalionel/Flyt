import { createClient } from "@supabase/supabase-js"
import { describe, expect, test } from "vitest"
import { buildSeed } from "@/lib/mock-data"
import { placeDistances, placeIds } from "@/lib/places"
import { distanceFare, fareSplit, quoteFare, sharedSeatFare } from "@/lib/pricing"
import type { PlaceId, TripType } from "@/lib/types"

// The Postgres fare engine gives the same Rwf amounts as lib/pricing.ts for every audit case:
// every place pair in both directions, both plans, shared seats, the 10/12/15% fee, airport zones and hire.
// Needs the local Supabase (anon key from .env.local or the environment).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321"
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
const db = createClient(url, key, { auth: { persistSession: false } })
const seed = buildSeed()
const plans = seed.pricing.plans

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.rpc(name, args)
  if (error) throw new Error(`${name}: ${error.message}`)
  return data as T
}

describe("fare parity: Postgres = lib/pricing.ts", () => {
  test.skipIf(!key)("distance fare and shared seat, every pair, both plans", async () => {
    let checked = 0
    for (const plan of plans) {
      for (const row of placeDistances) {
        const args = { p_km: row.km, p_first_km: plan.firstKm, p_per_km: plan.perKm }
        expect(await rpc<number>("distance_fare", args)).toBe(distanceFare(row.km, plan))
        expect(await rpc<number>("shared_seat_fare", { ...args, p_percent: plan.sharedSeatPercent })).toBe(sharedSeatFare(row.km, plan))
        checked += 2
      }
      // Under 1 km pays the first km.
      expect(await rpc<number>("distance_fare", { p_km: 0.5, p_first_km: plan.firstKm, p_per_km: plan.perKm })).toBe(distanceFare(0.5, plan))
    }
    expect(checked).toBe(180)
  })

  test.skipIf(!key)("platform fee at 10, 12 and 15%, including halves", async () => {
    for (const fare of [630, 1575, 2700, 3450, 3825, 4200, 8325, 8500, 12000, 104015]) {
      for (const percent of [10, 12, 15]) expect(await rpc<number>("platform_fee", { p_fare: fare, p_percent: percent })).toBe(fareSplit(fare, percent).platformFee)
    }
  })

  test.skipIf(!key)("full quotes with the active plan: private, shared, airport zones and fallback, hire", async () => {
    const firm = seed.firms.find((item) => item.id === "firm-2")!
    const cases: { type: TripType; pickup: PlaceId; dropoff: PlaceId; qty?: number }[] = []
    for (const from of placeIds) for (const to of placeIds) {
      if (from === to) continue
      cases.push({ type: "private", pickup: from, dropoff: to }, { type: "shared_commute", pickup: from, dropoff: to })
      if (from === "airport" || to === "airport") cases.push({ type: "airport", pickup: from, dropoff: to })
    }
    for (const qty of [1, 2, 3]) cases.push({ type: "hourly", pickup: "kacyiru", dropoff: "kacyiru", qty }, { type: "daily", pickup: "remera", dropoff: "kcc", qty })
    for (const item of cases) {
      const ts = quoteFare({ type: item.type, pickup: item.pickup, dropoff: item.dropoff, hireQuantity: item.qty, firm }, seed.pricing)
      const pg = await rpc<{ fare: number; distanceKm: number; planName: string; rule: string }>("fare_quote", { p_type: item.type, p_pickup: item.pickup, p_dropoff: item.dropoff, p_hire_quantity: item.qty ?? null, p_firm: firm.id })
      expect({ ...pg, distanceKm: Number(pg.distanceKm) }, `${item.type} ${item.pickup}→${item.dropoff}`).toEqual(ts)
    }
    expect(cases.length).toBe(90 + 90 + 18 + 6)
  })
})
