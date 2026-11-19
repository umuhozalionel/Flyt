import { pricingPlan } from "./mock-data"
import type { PricingPlan, TripType } from "./types"
export function calculateFare(distanceKm: number, type: TripType = "private", plan: PricingPlan = pricingPlan) {
  const distance = Math.max(1, distanceKm)
  const privateFare = plan.firstKm + Math.max(0, distance - 1) * plan.perKm
  if (type === "shared_commute") return Math.round(privateFare * plan.sharedSeatPercent / 100)
  if (type === "hourly") return 12000
  if (type === "daily") return 40000
  if (type === "airport") { const zone = plan.airportZones.find((item) => item.zone === "Airport ↔ City Centre"); return zone?.price ?? privateFare }
  return Math.round(privateFare)
}
export function fareSplit(fare: number, feePercent = pricingPlan.platformFeePercent) { const platformFee = Math.round(fare * feePercent / 100); return { fare, platformFee, firmKeeps: fare - platformFee } }
