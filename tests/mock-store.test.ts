import { beforeEach, describe, expect, test, vi } from "vitest"
import { __resetMockStore, mockSource as api } from "@/lib/data/mock"
import { buildSeed } from "@/lib/mock-data"
import { TransitionError } from "@/lib/trip-rules"

beforeEach(() => __resetMockStore(buildSeed(new Date())))

async function onlineDriver(firmId: string) {
  const [drivers, cars] = await Promise.all([api.getDrivers(), api.getCars()])
  return drivers.find((driver) => driver.firmId === firmId && driver.status === "online" && driver.approval === "approved" && cars.find((car) => car.id === driver.carId)?.availability === "available")!
}
async function pendingOffer(tripId: string) {
  return (await api.getOffers()).find((offer) => offer.tripId === tripId && offer.status === "pending")!
}

describe("booking", () => {
  test("price comes from the active plan, not the screen", async () => {
    const trip = await api.createBooking({ riderId: "rider-20", pickup: "remera", dropoff: "airport", type: "airport", paymentMethod: "momo" })
    expect(trip).toMatchObject({ fare: 4200, distanceKm: 5, planName: "Test", status: "requested", paymentStatus: "pending" }) // Remera zone has no price: 1,200 + 4 × 750
    expect(trip.platformFee).toBe(504) // 12% of 4,200
  })
  test("hire goes to a firm with hire rates", async () => {
    const trip = await api.createBooking({ riderId: "rider-20", pickup: "kcc", dropoff: "kcc", type: "daily", hireQuantity: 2, paymentMethod: "airtel" })
    expect(trip).toMatchObject({ firmId: "firm-2", fare: 80000, platformFee: 9600, hireQuantity: 2 }) // 40,000 × 2; 12% = 9,600
  })
  test("company billing is refused for riders without a company", async () => {
    await expect(api.createBooking({ riderId: "rider-20", pickup: "remera", dropoff: "kcc", type: "private", paymentMethod: "company_account" })).rejects.toThrow()
  })
  test("company staff are billed to the company", async () => {
    const trip = await api.createBooking({ riderId: "rider-1", pickup: "remera", dropoff: "kcc", type: "private", paymentMethod: "company_account" })
    expect(trip).toMatchObject({ companyId: "co-1", paymentStatus: "billed_to_company" })
  })
  test("scheduled rides wait in the queue", async () => {
    const trip = await api.createBooking({ riderId: "rider-20", pickup: "remera", dropoff: "kcc", type: "private", paymentMethod: "momo", scheduledFor: new Date(Date.now() + 86_400_000).toISOString() })
    expect(trip.status).toBe("scheduled")
    const driver = await onlineDriver(trip.firmId)
    expect((await api.assignDriver(trip.id, driver.id)).status).toBe("assigned") // scheduled → assigned is allowed
  })
})

describe("trip flow", () => {
  test("assign → accept → arrived → start → end → paid", async () => {
    const trip = await api.createBooking({ riderId: "rider-20", pickup: "kimihurura", dropoff: "kcc", type: "private", paymentMethod: "momo" })
    const driver = await onlineDriver(trip.firmId)
    const assigned = await api.assignDriver(trip.id, driver.id)
    expect(assigned).toMatchObject({ status: "assigned", driverId: driver.id, carId: driver.carId })
    expect(assigned.assignedAt).toBeDefined()
    expect((await api.getDrivers()).find((item) => item.id === driver.id)?.status).toBe("on_trip")
    const accepted = await api.respondOffer((await pendingOffer(trip.id)).id, true)
    expect(accepted.status).toBe("driver_arriving")
    expect((await api.driverArrived(trip.id)).arrivedAt).toBeDefined()
    expect((await api.startTrip(trip.id, (await api.getTripPin(trip.id))!)).startedAt).toBeDefined()
    const ended = await api.endTrip(trip.id)
    expect(ended).toMatchObject({ status: "completed", fare: 1575 }) // 1.5 km on Test: 1,200 + 0.5 × 750
    expect(ended.receiptNo).toMatch(/^EBM-/)
    expect((await api.getDrivers()).find((item) => item.id === driver.id)?.status).toBe("online")
    expect((await api.riderMarkPaid(trip.id))).toMatchObject({ paymentStatus: "pending" })
    expect((await api.confirmPayment(trip.id, true))).toMatchObject({ paymentStatus: "paid" })
  })
  test("blocked moves are rejected", async () => {
    const trip = await api.createBooking({ riderId: "rider-20", pickup: "remera", dropoff: "kcc", type: "private", paymentMethod: "momo" })
    await expect(api.startTrip(trip.id, (await api.getTripPin(trip.id))!)).rejects.toBeInstanceOf(TransitionError)
    await expect(api.endTrip(trip.id)).rejects.toBeInstanceOf(TransitionError)
  })
  test("a declined offer sends the trip back to requested", async () => {
    const trip = await api.createBooking({ riderId: "rider-20", pickup: "remera", dropoff: "kcc", type: "private", paymentMethod: "momo" })
    const driver = await onlineDriver(trip.firmId)
    await api.assignDriver(trip.id, driver.id)
    const declined = await api.respondOffer((await pendingOffer(trip.id)).id, false)
    expect(declined).toMatchObject({ status: "requested", driverId: undefined, carId: undefined })
    expect((await api.getDrivers()).find((item) => item.id === driver.id)?.status).toBe("online")
  })
  test("an offer expires after 20 seconds and the trip goes back to requested", async () => {
    const trip = await api.createBooking({ riderId: "rider-20", pickup: "remera", dropoff: "kcc", type: "private", paymentMethod: "momo" })
    const driver = await onlineDriver(trip.firmId)
    await api.assignDriver(trip.id, driver.id)
    const offer = await pendingOffer(trip.id)
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(Date.parse(offer.expiresAt) + 1000)
    expect((await api.getTrip(trip.id))?.status).toBe("requested")
    await expect(api.respondOffer(offer.id, true)).rejects.toThrow("expired")
    vi.useRealTimers()
  })
  test("reassign from assigned and driver_arriving only", async () => {
    const trip = await api.createBooking({ riderId: "rider-20", pickup: "remera", dropoff: "kcc", type: "private", paymentMethod: "momo" })
    const first = await onlineDriver(trip.firmId)
    await api.assignDriver(trip.id, first.id)
    await api.respondOffer((await pendingOffer(trip.id)).id, true)
    const second = await onlineDriver(trip.firmId)
    const moved = await api.reassignDriver(trip.id, second.id)
    expect(moved).toMatchObject({ status: "assigned", driverId: second.id })
    expect((await api.getDrivers()).find((item) => item.id === first.id)?.status).toBe("online")
    await api.respondOffer((await pendingOffer(trip.id)).id, true)
    await api.driverArrived(trip.id)
    const third = await onlineDriver(trip.firmId)
    await expect(api.reassignDriver(trip.id, third.id)).rejects.toThrow()
  })
  test("cancel needs a reason and frees the driver", async () => {
    const trip = await api.createBooking({ riderId: "rider-20", pickup: "remera", dropoff: "kcc", type: "private", paymentMethod: "momo" })
    const driver = await onlineDriver(trip.firmId)
    await api.assignDriver(trip.id, driver.id)
    await expect(api.cancelTrip(trip.id, "rider", " ")).rejects.toThrow()
    const cancelled = await api.cancelTrip(trip.id, "rider", "Plans changed")
    expect(cancelled).toMatchObject({ status: "cancelled_by_rider", cancelledBy: "rider", cancelReason: "Plans changed" })
    expect((await api.getDrivers()).find((item) => item.id === driver.id)?.status).toBe("online")
  })
  test("hire trips cannot move to another firm's driver", async () => {
    const trip = await api.createBooking({ riderId: "rider-20", pickup: "kcc", dropoff: "kcc", type: "hourly", hireQuantity: 2, paymentMethod: "momo" })
    const other = await onlineDriver("firm-1")
    await expect(api.assignDriver(trip.id, other.id)).rejects.toThrow()
  })
})

describe("riders", () => {
  test("new riders must accept the terms and get a clean profile (audit bug 2)", async () => {
    await expect(api.signInRider({ phone: "0788 123 456", name: "Test Person", consent: false })).rejects.toThrow()
    const rider = await api.signInRider({ phone: "0788 123 456", name: "Test Person", consent: true })
    expect(rider).toMatchObject({ name: "Test Person", phone: "+250 788 123 456", companyId: undefined, savedPlaces: [], emergencyContacts: [] })
  })
  test("returning riders sign in by phone in any format", async () => {
    const rider = await api.signInRider({ phone: "250788410301", consent: false })
    expect(rider.id).toBe("rider-1")
  })
  test("join code links a company", async () => {
    const rider = await api.signInRider({ phone: "+250 788 999 111", name: "New Staff", consent: true, joinCode: "kivu-18" })
    expect(rider.companyId).toBe("co-2")
  })
})

describe("pricing settings", () => {
  test("switching the active plan changes new quotes", async () => {
    await api.setActivePlan("Baseline")
    expect((await api.quoteTrip({ type: "private", pickup: "remera", dropoff: "kcc" })).fare).toBe(3500) // 1,500 + 2 × 1,000
    await api.setActivePlan("Test")
    expect((await api.quoteTrip({ type: "private", pickup: "remera", dropoff: "kcc" })).fare).toBe(2700) // 1,200 + 2 × 750
  })
  test("fee is per firm and only 10, 12 or 15%", async () => {
    await expect(api.setFirmFee("firm-1", 11 as 12)).rejects.toThrow()
    await api.setFirmFee("firm-1", 15)
    const trip = await api.createBooking({ riderId: "rider-20", pickup: "remera", dropoff: "kcc", type: "private", paymentMethod: "momo" })
    expect(trip).toMatchObject({ firmId: "firm-1", fare: 2700, platformFee: 405 }) // 2,700 × 15% = 405
  })
})
