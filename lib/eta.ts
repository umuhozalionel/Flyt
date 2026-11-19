import { distanceBetween } from "./places"
import { firmsOffering } from "./pricing"
import type { Car, Driver, Firm, PlaceId, TripType } from "./types"

// Time estimates. Without live GPS in version 1, a driver is placed at their zone and Kigali traffic
// is taken as 2.5 minutes per km (about 24 km/h), plus 2 minutes to reach the car and set off.
export const MINUTES_PER_KM = 2.5
export const PICKUP_BUFFER_MINUTES = 2

/** Road km between two places; 0 when they are the same place. */
export function kmBetween(from: PlaceId, to: PlaceId) {
  return from === to ? 0 : distanceBetween(from, to)
}

export const driveMinutes = (km: number) => Math.ceil(km * MINUTES_PER_KM)
export const pickupMinutes = (km: number) => driveMinutes(km) + PICKUP_BUFFER_MINUTES

/** Minutes still to go on an estimate that started at `since`. Never less than 1 while not there yet. */
export function minutesLeft(totalMinutes: number, since: string | undefined, now: number = Date.now()) {
  const elapsed = since ? Math.max(0, Math.floor((now - Date.parse(since)) / 60_000)) : 0
  return Math.max(1, totalMinutes - elapsed)
}

/**
 * Minutes until the nearest free car could reach a pickup, for each ride type.
 * A type with no free car is left out. Hire types only count firms that set that rate.
 */
export function pickupEtas(pickup: PlaceId, types: TripType[], drivers: Driver[], cars: Car[], firms: Firm[]): Partial<Record<TripType, number>> {
  const result: Partial<Record<TripType, number>> = {}
  for (const type of types) {
    const firmIds = new Set(firmsOffering(type, firms).map((firm) => firm.id))
    let best: number | undefined
    for (const driver of drivers) {
      if (!firmIds.has(driver.firmId) || driver.approval !== "approved" || driver.status !== "online") continue
      if (cars.find((car) => car.id === driver.carId)?.availability !== "available") continue
      const km = kmBetween(driver.zone, pickup)
      if (best == null || km < best) best = km
    }
    if (best != null) result[type] = pickupMinutes(best)
  }
  return result
}
