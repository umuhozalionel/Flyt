import { beforeEach, describe, expect, test } from "vitest"
import { bonusProgress, busyAreas, chatOpen, chatRole, checkTipAmount, defaultSettings, hasPhoneNumber, isVerifiedRider, pointsForFare, prefsAllow, rewardPoints, tipOpen } from "@/lib/additions"
import { __resetMockStore, mockSource as api } from "@/lib/data/mock"
import { buildSeed } from "@/lib/mock-data"
import { suggestDrivers } from "@/lib/ops"
import type { Driver, Firm, Trip } from "@/lib/types"

// Phase 6B additions: the shared rules (lib/additions.ts) and the mock data source that uses them.
// The same rules run in Postgres; supabase/tests/flow_test.sql checks them there.

beforeEach(() => __resetMockStore(buildSeed(new Date())))

const trip = (over: Partial<Trip> = {}): Trip => ({
  id: "FLT-1",
  type: "private",
  riderId: "rider-1",
  firmId: "firm-1",
  driverId: "driver-1",
  pickup: "remera",
  dropoff: "kcc",
  distanceKm: 3,
  fare: 2700,
  platformFee: 324,
  planName: "Test",
  status: "in_progress",
  paymentMethod: "momo",
  paymentStatus: "pending",
  createdAt: "2026-11-19T08:00:00Z",
  updatedAt: "2026-11-19T08:00:00Z",
  ...over,
})

async function drive(tripId: string, driverId: string) {
  await api.assignDriver(tripId, driverId)
  const offer = (await api.getOffers(driverId)).find((item) => item.tripId === tripId && item.status === "pending")!
  await api.respondOffer(offer.id, true)
  await api.driverArrived(tripId)
  await api.startTrip(tripId, (await api.getTripPin(tripId))!)
  return api.endTrip(tripId)
}

describe("rules", () => {
  test("chat is open only while the trip is active, or 24 h after a lost-item report", () => {
    expect(chatOpen(trip({ status: "driver_arriving" }), [])).toBe(true)
    expect(chatOpen(trip({ status: "completed" }), [])).toBe(false)
    const now = Date.parse("2026-11-19T10:00:00Z")
    const item = { id: "L", tripId: "FLT-1", riderId: "rider-1", incidentId: "I", description: "bag", status: "open" as const, chatOpenUntil: "2026-11-20T09:00:00Z", createdAt: "" }
    expect(chatOpen(trip({ status: "completed" }), [item], now)).toBe(true)
    expect(chatOpen(trip({ status: "completed" }), [item], Date.parse("2026-11-20T09:00:01Z"))).toBe(false)
  })
  test("rule b: a company admin chats only on company-billed trips of their company", () => {
    expect(chatRole(trip({ paymentMethod: "company_account", companyId: "co-1" }), "company_driver", { companyId: "co-1" })).toBe("company")
    expect(chatRole(trip({ paymentMethod: "momo", companyId: undefined }), "company_driver", { companyId: "co-1" })).toBeUndefined()
    expect(chatRole(trip({ paymentMethod: "company_account", companyId: "co-2" }), "company_driver", { companyId: "co-1" })).toBeUndefined()
    expect(chatRole(trip(), "rider_driver", { companyId: "co-1" })).toBeUndefined()
  })
  test("rule c: no phone numbers in chat", () => {
    expect(hasPhoneNumber("call me 0788 123 456")).toBe(true)
    expect(hasPhoneNumber("+250-788-123-456")).toBe(true)
    expect(hasPhoneNumber("I'm at gate 2, 5 minutes")).toBe(false)
  })
  test("preferences: ride types and heading home shape suggestions", () => {
    const now = Date.parse("2026-11-19T10:00:00Z")
    const prefs = { driverId: "d", rideTypes: ["private" as const], headingHomeZone: "kicukiro" as const, headingHomeUntil: "2026-11-19T12:00:00Z" }
    expect(prefsAllow({ type: "airport", dropoff: "kicukiro" }, prefs, now)).toBe(false) // type not accepted
    expect(prefsAllow({ type: "private", dropoff: "kcc" }, prefs, now)).toBe(false) // heading home elsewhere
    expect(prefsAllow({ type: "private", dropoff: "kicukiro" }, prefs, now)).toBe(true)
    expect(prefsAllow({ type: "private", dropoff: "kcc" }, prefs, Date.parse("2026-11-19T12:00:01Z"))).toBe(true) // heading home over
  })
  test("favourites come first on scheduled rides only", () => {
    const seed = buildSeed(new Date())
    const scheduled = trip({ status: "scheduled", driverId: undefined, pickup: "remera" })
    const plain = suggestDrivers(scheduled, seed.drivers, seed.cars, seed.firms, {}, 5)
    const favourite = plain[plain.length - 1].driver.id
    const ranked = suggestDrivers(scheduled, seed.drivers, seed.cars, seed.firms, {}, 5, { favourites: [{ riderId: "rider-1", driverId: favourite, createdAt: "" }] })
    expect(ranked[0]).toMatchObject({ favourite: true })
    expect(ranked[0].driver.id).toBe(favourite)
    const now = suggestDrivers({ ...scheduled, status: "requested" }, seed.drivers, seed.cars, seed.firms, {}, 5, { favourites: [{ riderId: "rider-1", driverId: favourite, createdAt: "" }] })
    expect(now[0].driver.id).toBe(plain[0].driver.id)
  })
  test("busy areas count waiting requests per zone", () => {
    const now = Date.parse("2026-11-19T10:00:00Z")
    const rows = [trip({ status: "requested", pickup: "remera" }), trip({ status: "requested", pickup: "remera" }), trip({ status: "requested", pickup: "kcc" }), trip({ status: "scheduled", pickup: "kcc", scheduledFor: "2026-11-19T10:30:00Z" }), trip({ status: "scheduled", pickup: "gisozi", scheduledFor: "2026-11-19T15:00:00Z" })]
    expect(busyAreas(rows, now)).toEqual([
      { zone: "kcc", waiting: 2 },
      { zone: "remera", waiting: 2 },
    ])
  })
  test("points: 1 per full Rwf 1,000, tracking only", () => {
    expect(pointsForFare(3450, 1)).toBe(3) // floor(3,450 / 1,000) = 3
    expect(pointsForFare(999, 1)).toBe(0)
    expect(pointsForFare(80000, 1)).toBe(80)
    const done = [trip({ status: "completed", fare: 3450, completedAt: "2026-11-19T09:00:00Z" }), trip({ id: "FLT-2", status: "completed", fare: 2700, completedAt: "2026-11-19T09:30:00Z" })]
    expect(rewardPoints("rider-1", done, defaultSettings).total).toBe(5) // 3 + 2
  })
  test("tips: driver opted in, firm on, within 24 hours; Rwf 1 to 10,000", () => {
    const done = trip({ status: "completed", completedAt: "2026-11-19T08:00:00Z" })
    const driver = { tipsOptIn: true, tipMomoNumber: "+250 788 330 112" } as Driver
    const firm = { tipsEnabled: true } as Firm
    expect(tipOpen(done, driver, firm, Date.parse("2026-11-20T07:59:00Z"))).toBe(true)
    expect(tipOpen(done, driver, firm, Date.parse("2026-11-20T08:00:01Z"))).toBe(false) // after 24 h
    expect(tipOpen(done, { ...driver, tipsOptIn: false }, firm, Date.parse("2026-11-19T09:00:00Z"))).toBe(false)
    expect(tipOpen(done, driver, { tipsEnabled: false } as Firm, Date.parse("2026-11-19T09:00:00Z"))).toBe(false)
    expect(() => checkTipAmount(10_000)).not.toThrow()
    expect(() => checkTipAmount(10_001)).toThrow("A tip is from Rwf 1 to Rwf 10,000")
    expect(() => checkTipAmount(0)).toThrow()
  })
  test("bonus progress is empty while bonuses are off", () => {
    const target = { id: "b", name: "3 today", metric: "completed_trips" as const, period: "day" as const, target: 3, active: true, createdAt: "" }
    const done = [trip({ status: "completed", completedAt: new Date().toISOString() })]
    expect(bonusProgress({ id: "driver-1", firmId: "firm-1" }, [target], done, defaultSettings)).toEqual([])
    expect(bonusProgress({ id: "driver-1", firmId: "firm-1" }, [target], done, { ...defaultSettings, bonusesEnabled: true })).toEqual([{ targetId: "b", name: "3 today", period: "day", target: 3, done: 1 }])
  })
  test("verified badge: linked to an active company", () => {
    expect(isVerifiedRider({ companyId: "co-1" }, [{ id: "co-1", status: "active" }])).toBe(true)
    expect(isVerifiedRider({ companyId: "co-1" }, [{ id: "co-1", status: "pending" }])).toBe(false)
    expect(isVerifiedRider({}, [{ id: "co-1", status: "active" }])).toBe(false)
  })
})

describe("mock data source", () => {
  test("the trip starts only with the rider's PIN; 5 wrong tries block it", async () => {
    const booked = await api.createBooking({ riderId: "rider-20", pickup: "remera", dropoff: "kcc", type: "private", paymentMethod: "momo" })
    await api.assignDriver(booked.id, "driver-2")
    const offer = (await api.getOffers("driver-2")).find((item) => item.tripId === booked.id)!
    await api.respondOffer(offer.id, true)
    await api.driverArrived(booked.id)
    const pin = (await api.getTripPin(booked.id))!
    expect(pin).toMatch(/^\d{4}$/)
    const wrong = pin === "0000" ? "1111" : "0000"
    await expect(api.startTrip(booked.id, wrong)).rejects.toThrow("That PIN is not right")
    expect((await api.startTrip(booked.id, pin)).status).toBe("in_progress")
  })
  test("too many wrong PINs block the start", async () => {
    const booked = await api.createBooking({ riderId: "rider-20", pickup: "remera", dropoff: "kcc", type: "private", paymentMethod: "momo" })
    await api.assignDriver(booked.id, "driver-2")
    await api.respondOffer((await api.getOffers("driver-2")).find((item) => item.tripId === booked.id)!.id, true)
    await api.driverArrived(booked.id)
    const pin = (await api.getTripPin(booked.id))!
    const wrong = pin === "0000" ? "1111" : "0000"
    for (let i = 0; i < 5; i++) await expect(api.startTrip(booked.id, wrong)).rejects.toThrow("That PIN is not right")
    await expect(api.startTrip(booked.id, pin)).rejects.toThrow("Too many wrong PINs")
  })
  test("dispatch: the open queue is for platform admins; firm admins reassign their own firm's trips", async () => {
    const booked = await api.createBooking({ riderId: "rider-20", pickup: "remera", dropoff: "kcc", type: "private", paymentMethod: "momo" })
    await expect(api.assignDriver(booked.id, "driver-2", "admin-2")).rejects.toThrow("The open queue is for Flyt Operations")
    await api.assignDriver(booked.id, "driver-2", "admin-1")
    expect((await api.reassignDriver(booked.id, "driver-4", "admin-2")).driverId).toBe("driver-4") // firm-1 admin, firm-1 drivers
    await expect(api.reassignDriver(booked.id, "driver-8", "admin-2")).rejects.toThrow("The open queue is for Flyt Operations")
  })
  test("notifications follow the trip and respect mutes", async () => {
    const rider = { kind: "rider" as const, id: "rider-20" }
    await api.setNotificationMute(rider, "trip_started", true)
    const booked = await api.createBooking({ riderId: "rider-20", pickup: "remera", dropoff: "kcc", type: "private", paymentMethod: "momo" })
    await drive(booked.id, "driver-2")
    const types = (await api.getNotifications(rider)).filter((item) => item.tripId === booked.id).map((item) => item.type)
    expect(types).toEqual(expect.arrayContaining(["driver_assigned", "driver_arrived", "receipt_ready"]))
    expect(types).not.toContain("trip_started")
    expect((await api.getNotifications({ kind: "driver", id: "driver-2" })).some((item) => item.type === "offer_new" && item.tripId === booked.id)).toBe(true)
    await api.markNotificationsRead(rider)
    expect((await api.getNotifications(rider)).every((item) => item.readAt)).toBe(true)
  })
  test("chat: no phone numbers, closed after the trip, reopened by a lost-item report", async () => {
    const booked = await api.createBooking({ riderId: "rider-20", pickup: "remera", dropoff: "kcc", type: "private", paymentMethod: "momo" })
    await api.assignDriver(booked.id, "driver-2")
    const me = { sender: "rider" as const, senderId: "rider-20" }
    await api.sendChat({ tripId: booked.id, channel: "rider_driver", body: "I'm at the gate", quickReply: true, from: me })
    await expect(api.sendChat({ tripId: booked.id, channel: "rider_driver", body: "0788 123 456", from: me })).rejects.toThrow("Phone numbers cannot be sent in chat")
    await expect(api.sendChat({ tripId: booked.id, channel: "rider_driver", body: "hi", from: { sender: "rider", senderId: "rider-1" } })).rejects.toThrow("This is not your trip")
    await api.respondOffer((await api.getOffers("driver-2")).find((item) => item.tripId === booked.id)!.id, true)
    await api.driverArrived(booked.id)
    await api.startTrip(booked.id, (await api.getTripPin(booked.id))!)
    await api.endTrip(booked.id)
    await expect(api.sendChat({ tripId: booked.id, channel: "rider_driver", body: "hello", from: me })).rejects.toThrow("Chat is closed for this trip")
    const item = await api.reportLostItem(booked.id, "Black backpack")
    expect((await api.getIncidents()).find((incident) => incident.id === item.incidentId)?.type).toBe("lost_item")
    await api.sendChat({ tripId: booked.id, channel: "rider_driver", body: "Did you find my backpack?", from: me })
    expect(await api.getChat(booked.id, "rider_driver")).toHaveLength(2)
  })
  test("a sharing link stops working when the trip ends", async () => {
    const booked = await api.createBooking({ riderId: "rider-20", pickup: "remera", dropoff: "kcc", type: "private", paymentMethod: "momo" })
    const token = await api.createTripShare(booked.id)
    const view = await api.getSharedTrip(token)
    expect(view).toMatchObject({ status: "requested", pickup: "remera", dropoff: "kcc" })
    expect(JSON.stringify(view)).not.toMatch(/fare|phone/i) // no fare, no phone numbers
    await drive(booked.id, "driver-2")
    expect(await api.getSharedTrip(token)).toBeUndefined()
    await expect(api.createTripShare(booked.id)).rejects.toThrow("This trip has ended")
  })
  test("tips: off until the firm allows them and the driver opts in; one per trip, Flyt holds nothing", async () => {
    const booked = await api.createBooking({ riderId: "rider-20", pickup: "remera", dropoff: "kcc", type: "private", paymentMethod: "momo" })
    const firmId = booked.firmId
    const driver = (await api.getDrivers()).find((item) => item.firmId === firmId && item.status === "online")!
    await drive(booked.id, driver.id)
    expect(await api.getTipDetails(booked.id)).toBeUndefined()
    await api.setFirmTips(firmId, true)
    expect(await api.getTipDetails(booked.id)).toBeUndefined() // driver has not opted in
    await expect(api.setTipSettings(driver.id, { optIn: true })).rejects.toThrow("Add the MoMo number")
    await api.setTipSettings(driver.id, { optIn: true, momoNumber: "0788 330 112" })
    expect(await api.getTipDetails(booked.id)).toMatchObject({ momoNumber: "+250 788 330 112", alreadyTipped: false })
    await expect(api.recordTip(booked.id, 10_001)).rejects.toThrow("Rwf 10,000")
    expect((await api.recordTip(booked.id, 1000)).amount).toBe(1000)
    await expect(api.recordTip(booked.id, 500)).rejects.toThrow("already tipped")
  })
  test("favourite a driver only after a trip together", async () => {
    await expect(api.setFavouriteDriver("rider-20", "driver-2", true)).rejects.toThrow("after a trip")
    const booked = await api.createBooking({ riderId: "rider-20", pickup: "remera", dropoff: "kcc", type: "private", paymentMethod: "momo" })
    await drive(booked.id, "driver-2")
    await api.setFavouriteDriver("rider-20", "driver-2", true)
    expect(await api.getFavouriteDrivers("rider-20")).toEqual([expect.objectContaining({ driverId: "driver-2" })])
  })
  test("heading home lasts up to 12 hours", async () => {
    await expect(api.setDriverPreferences("driver-2", { rideTypes: ["private"], headingHomeZone: "kicukiro", headingHomeUntil: new Date(Date.now() + 13 * 3_600_000).toISOString() })).rejects.toThrow("12 hours")
    const saved = await api.setDriverPreferences("driver-2", { rideTypes: ["private"], headingHomeZone: "kicukiro", headingHomeUntil: new Date(Date.now() + 2 * 3_600_000).toISOString() })
    expect(saved).toMatchObject({ rideTypes: ["private"], headingHomeZone: "kicukiro" })
  })
})
