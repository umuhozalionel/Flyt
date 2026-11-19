import { beforeEach, describe, expect, test } from "vitest"
import { __resetMockStore, mockSource as api } from "@/lib/data/mock"
import { directionsUrl, driverEarnings, riderForDriver, weekStart } from "@/lib/driver"
import { minutesLeft, pickupEtas, pickupMinutes } from "@/lib/eta"
import { buildSeed } from "@/lib/mock-data"
import { partOfDay } from "@/lib/time"
import type { Rider, Trip } from "@/lib/types"

const NOW = new Date("2026-11-19T10:00:00Z") // Thursday, 12:00 in Kigali
beforeEach(() => __resetMockStore(buildSeed(new Date())))

describe("driver rules", () => {
  const rider = { id: "r", name: "Aline Mukamana", phone: "+250 788 410 301" } as Rider
  const trip = (status: Trip["status"], extra: Partial<Trip> = {}) => ({ id: "t", riderId: "r", status, ...extra }) as Trip

  test("rider phone only while the trip is active; first name only", () => {
    for (const status of ["assigned", "driver_arriving", "driver_arrived", "in_progress"] as const) expect(riderForDriver(trip(status), rider, []).phone).toBe("+250 788 410 301")
    for (const status of ["completed", "cancelled_by_rider", "requested"] as const) expect(riderForDriver(trip(status), rider, []).phone).toBeUndefined()
    expect(riderForDriver(trip("assigned"), rider, []).firstName).toBe("Aline")
  })

  test("rider rating is the average of driver ratings, one decimal", () => {
    const history = [trip("completed", { driverRating: 5 }), trip("completed", { driverRating: 4 }), trip("completed", { driverRating: 4 }), trip("cancelled_by_rider")]
    expect(riderForDriver(trip("assigned"), rider, history)).toMatchObject({ rating: 4.3, tripCount: 3 }) // 13 / 3 = 4.33
  })

  test("earnings: today, this week from Monday, this month, in Kigali time", () => {
    const done = (completedAt: string, fare: number) => ({ id: completedAt, driverId: "d", status: "completed", completedAt, fare }) as Trip
    const trips = [
      done("2026-11-19T06:00:00Z", 4200), // today
      done("2026-11-18T21:30:00Z", 2700), // 23:30 Kigali on Wednesday: this week, not today
      done("2026-11-16T05:00:00Z", 5700), // Monday: this week
      done("2026-11-15T21:59:00Z", 1950), // Sunday 23:59 Kigali: last week, this month
      done("2026-10-31T22:30:00Z", 3000), // 00:30 on 1 November in Kigali: this month
      done("2026-10-31T21:30:00Z", 9999), // 23:30 on 31 October in Kigali: last month
    ]
    expect(weekStart("2026-11-19")).toBe("2026-11-16")
    expect(weekStart("2026-11-16")).toBe("2026-11-16")
    expect(weekStart("2026-11-22")).toBe("2026-11-16")
    expect(driverEarnings(trips, "d", NOW)).toEqual({
      today: { trips: 1, fares: 4200 },
      week: { trips: 3, fares: 12600 }, // 4,200 + 2,700 + 5,700
      month: { trips: 5, fares: 17550 }, // 12,600 + 1,950 + 3,000
    })
  })

  test("directions link uses the place coordinates", () => {
    expect(directionsUrl({ name: "Remera", lat: -1.9578, lng: 30.1127 })).toBe("https://www.google.com/maps/dir/?api=1&destination=-1.9578%2C30.1127")
  })
})

describe("ETAs and greeting", () => {
  test("pickup ETA: 2.5 min per km, rounded up, plus 2 min", () => {
    expect(pickupMinutes(0)).toBe(2)
    expect(pickupMinutes(3)).toBe(10) // 7.5 → 8, + 2
    expect(pickupMinutes(7)).toBe(20) // 17.5 → 18, + 2
  })
  test("nearest free car per ride type", () => {
    const db = buildSeed(NOW)
    // Remera: Grace (online, Remera) is 0 km away. Hourly hire only counts Imena, whose nearest free driver is in City Centre, 7 km.
    expect(pickupEtas("remera", ["private", "hourly"], db.drivers, db.cars, db.firms)).toEqual({ private: 2, hourly: 20 })
  })
  test("countdown never shows less than 1 minute", () => {
    const since = new Date(NOW.getTime() - 9 * 60_000).toISOString()
    expect(minutesLeft(10, since, NOW.getTime())).toBe(1)
    expect(minutesLeft(10, since, NOW.getTime() + 10 * 60_000)).toBe(1)
    expect(minutesLeft(20, since, NOW.getTime())).toBe(11)
  })
  test("greeting by Kigali hour", () => {
    expect([4, 5, 11, 12, 17, 18, 23].map(partOfDay)).toEqual(["evening", "morning", "morning", "afternoon", "afternoon", "evening", "evening"])
  })
})

describe("driver app data", () => {
  test("seed: the assigned trip has an open 20-second offer", async () => {
    const trips = await api.getTrips()
    const assigned = trips.filter((trip) => trip.status === "assigned")
    expect(assigned).toHaveLength(1)
    const offers = await api.getOffers(assigned[0].driverId)
    expect(offers).toEqual([expect.objectContaining({ tripId: assigned[0].id, status: "pending" })])
  })

  test("sign in by phone in any format; unknown numbers are refused", async () => {
    expect((await api.signInDriver({ phone: "0788 330 111" })).id).toBe("driver-2")
    await expect(api.signInDriver({ phone: "0788 999 000" })).rejects.toThrow("not registered")
  })

  test("a driver only sees their own trips, and the rider's phone only while active", async () => {
    const trip = (await api.getTrips()).find((item) => item.status === "in_progress")!
    expect(await api.getDriverJob(trip.id, "driver-2")).toBeUndefined()
    const job = (await api.getDriverJob(trip.id, trip.driverId!))!
    expect(job.rider.phone).toMatch(/^\+250/)
    expect(job.rider).not.toHaveProperty("name")
    await api.endTrip(trip.id)
    expect((await api.getDriverJob(trip.id, trip.driverId!))!.rider.phone).toBeUndefined()
  })

  test("accept within 20 seconds, then arrive, start, end, confirm payment and rate the rider", async () => {
    const rider = (await api.getRiders()).find((item) => item.id === "rider-20")!
    const booked = await api.createBooking({ riderId: rider.id, pickup: "remera", dropoff: "kcc", type: "private", paymentMethod: "momo" })
    await api.assignDriver(booked.id, "driver-2")
    const offer = (await api.getOffers("driver-2")).find((item) => item.status === "pending")!
    expect((await api.respondOffer(offer.id, true)).status).toBe("driver_arriving")
    await api.driverArrived(booked.id)
    await api.startTrip(booked.id)
    const ended = await api.endTrip(booked.id)
    expect(ended).toMatchObject({ status: "completed", fare: 2700 }) // 1,200 + 2 × 750
    await api.riderMarkPaid(booked.id)
    expect((await api.confirmPayment(booked.id, true)).paymentStatus).toBe("paid")
    expect((await api.rateRider(booked.id, 5)).driverRating).toBe(5)
    expect((await api.getDrivers()).find((item) => item.id === "driver-2")!.status).toBe("online")
  })

  test("a new document goes to review; going online needs valid documents", async () => {
    const driver = await api.submitDocument("driver-3", "professional_certificate", "2028-03-31")
    expect(driver.documents.find((doc) => doc.type === "professional_certificate")).toMatchObject({ review: "pending_review", expiryDate: "2028-03-31" })
    await expect(api.submitDocument("driver-3", "driving_licence", "2020-01-01")).rejects.toThrow("expired")
    await api.setDriverApproval("driver-12", "approved").catch(() => undefined) // expired licence: stays suspended
    await expect(api.setDriverPresence("driver-12", "online")).rejects.toThrow()
  })
})
