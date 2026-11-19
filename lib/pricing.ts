import { distanceBetween } from "./places"
import type { Firm, PlaceId, PlanName, PricingConfig, PricingPlan, TripType } from "./types"

// Fare engine used for price previews. The same rules run in Postgres (supabase/migrations),
// and tests/pricing-parity.test.ts proves both give the same results.
// Every amount is a whole number of Rwf. Rounding is Math.round (half up), which matches
// Postgres round() for positive amounts.

export function activePlan(config: PricingConfig): PricingPlan {
  const plan = config.plans.find((item) => item.isActive)
  if (!plan) throw new Error("No active price plan")
  return plan
}

/** Private-ride fare for a distance: first km, then the per-km price. Trips under 1 km pay the first-km price. */
export function distanceFare(distanceKm: number, plan: Pick<PricingPlan, "firstKm" | "perKm">) {
  const distance = Math.max(1, distanceKm)
  return Math.round(plan.firstKm + (distance - 1) * plan.perKm)
}

/** One seat on a shared commute: a share of the private fare for the same distance. */
export function sharedSeatFare(distanceKm: number, plan: Pick<PricingPlan, "firstKm" | "perKm" | "sharedSeatPercent">) {
  return Math.round((distanceFare(distanceKm, plan) * plan.sharedSeatPercent) / 100)
}

export type FareRule = "distance" | "shared_seat" | "airport_zone" | "airport_fallback" | "hourly" | "daily"

export interface FareInput {
  type: TripType
  pickup: PlaceId
  dropoff: PlaceId
  /** Hours for hourly hire, days for daily hire. */
  hireQuantity?: number
  /** The firm running the trip. Needed for hourly and daily hire, which use the firm's own rates. */
  firm?: Pick<Firm, "hourlyRate" | "dailyRate">
}

export interface FareQuote { fare: number; distanceKm: number; planName: PlanName; rule: FareRule }

export class FareError extends Error {}

export function tripDistance(type: TripType, pickup: PlaceId, dropoff: PlaceId) {
  if ((type === "hourly" || type === "daily") && pickup === dropoff) return 0
  return distanceBetween(pickup, dropoff)
}

export function quoteFare(input: FareInput, config: PricingConfig): FareQuote {
  const plan = activePlan(config)
  const distanceKm = tripDistance(input.type, input.pickup, input.dropoff)
  const base = { distanceKm, planName: plan.name }

  switch (input.type) {
    case "private":
      return { ...base, fare: distanceFare(distanceKm, plan), rule: "distance" }
    case "shared_commute":
      return { ...base, fare: sharedSeatFare(distanceKm, plan), rule: "shared_seat" }
    case "airport": {
      const other = input.pickup === "airport" ? input.dropoff : input.dropoff === "airport" ? input.pickup : undefined
      if (!other) throw new FareError("Airport transfers must start or end at Kigali International Airport")
      const zone = config.airportZones.find((item) => item.placeId === other)
      if (zone?.price != null) return { ...base, fare: zone.price, rule: "airport_zone" }
      return { ...base, fare: distanceFare(distanceKm, plan), rule: "airport_fallback" }
    }
    case "hourly":
    case "daily": {
      const quantity = input.hireQuantity ?? 1
      if (!Number.isInteger(quantity) || quantity < 1) throw new FareError("Hire length must be a whole number of hours or days")
      const rate = input.type === "hourly" ? input.firm?.hourlyRate : input.firm?.dailyRate
      if (rate == null) throw new FareError(`This firm has no ${input.type} rate`)
      return { ...base, fare: rate * quantity, rule: input.type }
    }
  }
}

/** How a fare is split between the firm and Flyt Ltd's platform fee. */
export function fareSplit(fare: number, feePercent: number) {
  const platformFee = Math.round((fare * feePercent) / 100)
  return { fare, platformFee, firmKeeps: fare - platformFee }
}

/** Firms that can run a ride type: active firms, and for hire only firms that set that rate. */
export function firmsOffering<T extends Pick<Firm, "status" | "hourlyRate" | "dailyRate">>(type: TripType, firms: T[]) {
  return firms.filter((firm) => {
    if (firm.status !== "active") return false
    if (type === "hourly") return firm.hourlyRate != null
    if (type === "daily") return firm.dailyRate != null
    return true
  })
}
