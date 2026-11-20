import { describe, expect, it } from "vitest"
import { bearing, boundsOf, carPosition, inKigali, isKigaliNight, KIGALI, nearestPlace, placeLngLat, routeLine, tripCarPosition } from "@/lib/map"
import { places } from "@/lib/places"

const metres = ([lng1, lat1]: [number, number], [lng2, lat2]: [number, number]) => {
  const x = (lng2 - lng1) * 111_320 * Math.cos((lat1 * Math.PI) / 180)
  const y = (lat2 - lat1) * 111_320
  return Math.hypot(x, y)
}

describe("map helpers", () => {
  it("places every place inside the Kigali area, and finds the nearest place", () => {
    for (const place of places) {
      expect(inKigali(placeLngLat(place.id))).toBe(true)
      expect(nearestPlace(placeLngLat(place.id))).toBe(place.id)
    }
    expect(inKigali([29.36, -1.68])).toBe(false) // Musanze
    expect(nearestPlace([30.14, -1.968])).toBe("airport")
  })

  it("draws free cars 250 to 650 m from their zone, moving slowly and the same for everyone", () => {
    const zone = placeLngLat("remera")
    for (const key of ["a", "b", "car-123", "driver-1"]) {
      for (const now of [0, 60_000, 3_600_000]) {
        const distance = metres(zone, carPosition(key, "remera", now))
        expect(distance).toBeGreaterThan(240)
        expect(distance).toBeLessThan(660)
      }
      expect(carPosition(key, "remera", 1000)).toEqual(carPosition(key, "remera", 1000))
      // In 3 seconds a car moves a little (well under 100 m).
      expect(metres(carPosition(key, "remera", 0), carPosition(key, "remera", 3000))).toBeLessThan(100)
    }
  })

  it("moves the trip car from the driver's zone to the pickup, then to the drop-off", () => {
    const accepted = Date.UTC(2026, 10, 19, 8, 0)
    const trip = { status: "driver_arriving" as const, pickup: "remera" as const, dropoff: "kcc" as const, acceptedAt: new Date(accepted).toISOString(), startedAt: undefined, distanceKm: 3 }
    const start = tripCarPosition(trip, "kicukiro", accepted)!
    expect(metres(start, placeLngLat("kicukiro"))).toBeLessThan(1)
    // Kicukiro → Remera is 5 km: 5 × 2.5 + 2 = 14.5 → 15 minutes. Halfway after 7.5 minutes.
    const half = tripCarPosition(trip, "kicukiro", accepted + 7.5 * 60_000)!
    expect(metres(half, [(placeLngLat("kicukiro")[0] + placeLngLat("remera")[0]) / 2, (placeLngLat("kicukiro")[1] + placeLngLat("remera")[1]) / 2])).toBeLessThan(5)
    // Never drawn on the pickup before the driver says they arrived.
    expect(metres(tripCarPosition(trip, "kicukiro", accepted + 60 * 60_000)!, placeLngLat("remera"))).toBeGreaterThan(10)
    expect(tripCarPosition({ ...trip, status: "driver_arrived" }, "kicukiro", accepted)).toEqual(placeLngLat("remera"))
    const started = { ...trip, status: "in_progress" as const, startedAt: new Date(accepted).toISOString() }
    expect(tripCarPosition(started, "kicukiro", accepted)).toEqual(placeLngLat("remera"))
    expect(tripCarPosition({ ...trip, status: "completed" }, "kicukiro", accepted)).toBeUndefined()
  })

  it("uses the dark style from 18:30 to 06:00 Kigali time (UTC+2)", () => {
    const at = (hour: number, minute = 0) => Date.UTC(2026, 10, 19, hour - 2, minute)
    expect(isKigaliNight(at(12))).toBe(false)
    expect(isKigaliNight(at(18, 29))).toBe(false)
    expect(isKigaliNight(at(18, 30))).toBe(true)
    expect(isKigaliNight(at(23))).toBe(true)
    expect(isKigaliNight(at(5, 59))).toBe(true)
    expect(isKigaliNight(at(6))).toBe(false)
  })

  it("draws routes as straight lines and fits bounds", () => {
    expect(routeLine("remera", "kcc").geometry.coordinates).toEqual([placeLngLat("remera"), placeLngLat("kcc")])
    expect(boundsOf([])).toBeUndefined()
    expect(boundsOf([placeLngLat("nyamirambo"), placeLngLat("airport")])).toEqual([
      [30.044, -1.98],
      [30.1395, -1.9686],
    ])
    expect(Math.round(bearing(KIGALI, [KIGALI[0], KIGALI[1] + 0.01]))).toBe(0)
    expect(Math.round(bearing(KIGALI, [KIGALI[0] + 0.01, KIGALI[1]]))).toBe(90)
  })
})
