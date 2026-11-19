import { offerSeconds } from "../config"
import { normalizePhone } from "../format"
import { buildSeed, SEED_VERSION, type MockDb } from "../mock-data"
import { FareError, fareSplit, firmsOffering, quoteFare } from "../pricing"
import { assertMove, reassignableStatuses } from "../trip-rules"
import type { Car, Driver, Firm, Rider, Trip, TripStatus } from "../types"
import type { DataSource, QuoteInput, RideQuote, Topic } from "./types"

// Mock data source: a client-side store seeded from lib/mock-data.ts.
// It is saved to localStorage and every change is broadcast, so the rider app, driver app,
// Ops and the company portal stay in sync in this tab and in other open tabs.

const STORAGE_KEY = "flyt-mock-db"
const CHANNEL = "flyt-mock"
const isBrowser = typeof window !== "undefined"

let db: MockDb | undefined
const listeners = new Set<{ topics: Topic[]; callback: () => void }>()
let channel: BroadcastChannel | undefined

function readStorage(): MockDb | undefined {
  if (!isBrowser) return undefined
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return undefined
    const parsed = JSON.parse(raw) as MockDb
    return parsed.version === SEED_VERSION ? parsed : undefined
  } catch {
    return undefined
  }
}

function writeStorage(value: MockDb) {
  if (!isBrowser) return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch {
    // Storage full or blocked: the demo keeps working in this tab only.
  }
}

function notifyLocal(topics: Topic[]) {
  for (const listener of listeners) if (listener.topics.some((topic) => topics.includes(topic))) listener.callback()
}

function ensureChannel() {
  if (!isBrowser || channel || typeof BroadcastChannel === "undefined") return
  channel = new BroadcastChannel(CHANNEL)
  channel.onmessage = (event: MessageEvent<Topic[]>) => {
    db = readStorage() ?? db
    notifyLocal(event.data)
  }
}

function store(): MockDb {
  ensureChannel()
  if (!db) {
    db = readStorage()
    if (!db) {
      db = buildSeed()
      writeStorage(db)
    }
  }
  return db
}

function commit(topics: Topic[]) {
  if (db) writeStorage(db)
  notifyLocal(topics)
  channel?.postMessage(topics)
}

const clone = <T,>(value: T): T => structuredClone(value)
const delay = (ms = 180) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const nowIso = () => new Date().toISOString()

function findTrip(id: string) {
  const trip = store().trips.find((item) => item.id === id)
  if (!trip) throw new Error("Trip not found")
  return trip
}
function findDriver(id: string) {
  const driver = store().drivers.find((item) => item.id === id)
  if (!driver) throw new Error("Driver not found")
  return driver
}
function findFirm(id: string) {
  const firm = store().firms.find((item) => item.id === id)
  if (!firm) throw new Error("Firm not found")
  return firm
}
function carOf(driver: Driver): Car | undefined {
  return store().cars.find((item) => item.id === driver.carId)
}

function move(trip: Trip, to: TripStatus) {
  assertMove(trip.status, to)
  trip.status = to
  trip.updatedAt = nowIso()
}

/** Free the driver and car attached to a trip. */
function release(trip: Trip) {
  if (!trip.driverId) return
  const driver = store().drivers.find((item) => item.id === trip.driverId)
  if (driver && driver.status === "on_trip") driver.status = "online"
  const car = store().cars.find((item) => item.id === trip.carId)
  if (car && car.availability === "in_use") car.availability = "available"
}

/** Expire pending offers whose 20 seconds have passed; the trip goes back to the Dispatch queue. */
function expireOffers() {
  const now = Date.now()
  let changed = false
  for (const offer of store().offers) {
    if (offer.status === "pending" && Date.parse(offer.expiresAt) <= now) {
      offer.status = "expired"
      const trip = store().trips.find((item) => item.id === offer.tripId)
      if (trip && trip.status === "assigned" && trip.driverId === offer.driverId) backToQueue(trip)
      changed = true
    }
  }
  if (changed) commit(["offers", "trips", "drivers", "cars"])
}

function backToQueue(trip: Trip) {
  release(trip)
  move(trip, "requested")
  trip.driverId = undefined
  trip.carId = undefined
  trip.assignedAt = undefined
}

function checkDriverCanTake(trip: Trip, driver: Driver) {
  if (driver.approval !== "approved") throw new Error("This driver is not approved")
  if (driver.status !== "online") throw new Error("This driver is not online")
  const car = carOf(driver)
  if (!car) throw new Error("This driver has no car")
  if (car.availability !== "available") throw new Error("This driver's car is not available")
  const firm = findFirm(driver.firmId)
  if (firm.status !== "active") throw new Error("This driver's firm is not active")
  // Hire prices are the firm's own rates, fixed at booking, so hire trips stay with that firm.
  if ((trip.type === "hourly" || trip.type === "daily") && driver.firmId !== trip.firmId) throw new Error("Hire trips must stay with the booked firm")
  return { car, firm }
}

function attach(trip: Trip, driver: Driver) {
  const { car, firm } = checkDriverCanTake(trip, driver)
  trip.driverId = driver.id
  trip.carId = car.id
  if (trip.firmId !== firm.id) {
    // The fare is fixed at booking; only the platform fee follows the new firm's rate.
    trip.firmId = firm.id
    trip.platformFee = fareSplit(trip.fare, firm.feePercent).platformFee
  }
  trip.assignedAt = nowIso()
  driver.status = "on_trip"
  car.availability = "in_use"
  const now = Date.now()
  store().offers.push({ id: `offer-${now}-${driver.id}`, tripId: trip.id, driverId: driver.id, status: "pending", createdAt: new Date(now).toISOString(), expiresAt: new Date(now + offerSeconds * 1000).toISOString() })
}

/** Pick the firm for a new booking: an active firm that offers the ride type, preferring one with a free driver. */
function pickFirm(type: Trip["type"]): Firm {
  const s = store()
  const candidates = firmsOffering(type, s.firms)
  if (!candidates.length) throw new FareError("No licensed partner offers this ride type right now")
  const withDriver = candidates.find((firm) => s.drivers.some((driver) => driver.firmId === firm.id && driver.approval === "approved" && driver.status === "online"))
  return withDriver ?? candidates[0]
}

function quote(input: QuoteInput): RideQuote {
  const firm = pickFirm(input.type)
  return { ...quoteFare({ ...input, firm }, store().pricing), firmId: firm.id }
}

function newRider(phone: string, name: string, companyId?: string): Rider {
  const now = nowIso()
  return { id: `rider-${Date.now()}`, name, phone, language: "en", companyId, savedPlaces: [], emergencyContacts: [], consentAt: now, createdAt: now }
}

export const mockSource: DataSource = {
  subscribe(topics, callback) {
    ensureChannel()
    const listener = { topics, callback }
    listeners.add(listener)
    return () => listeners.delete(listener)
  },

  async getFirms() { await delay(); return clone(store().firms) },
  async getCompanies() { await delay(); return clone(store().companies) },
  async getRiders() { await delay(); return clone(store().riders) },
  async getRider(id) { await delay(); return clone(store().riders.find((item) => item.id === id)) },
  async getDrivers() { await delay(); expireOffers(); return clone(store().drivers) },
  async getCars() { await delay(); return clone(store().cars) },
  async getTrips() { await delay(); expireOffers(); return clone([...store().trips].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) },
  async getTrip(id) { await delay(); expireOffers(); return clone(store().trips.find((item) => item.id === id)) },
  async getRiderTrips(riderId) {
    await delay()
    expireOffers()
    return clone(store().trips.filter((trip) => trip.riderId === riderId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
  },
  async getTripAssignment(tripId) {
    await delay()
    expireOffers()
    const s = store()
    const trip = s.trips.find((item) => item.id === tripId)
    if (!trip) return undefined
    return clone({
      trip,
      driver: s.drivers.find((item) => item.id === trip.driverId),
      car: s.cars.find((item) => item.id === trip.carId),
      firm: s.firms.find((item) => item.id === trip.firmId),
      rider: s.riders.find((item) => item.id === trip.riderId),
    })
  },
  async getOffers(driverId) { await delay(); expireOffers(); return clone(store().offers.filter((offer) => !driverId || offer.driverId === driverId)) },
  async getCommuteRoutes() { await delay(); return clone(store().commuteRoutes) },
  async getFeeInvoices() { await delay(); return clone(store().feeInvoices) },
  async getCompanyInvoices() { await delay(); return clone(store().companyInvoices) },
  async getIncidents() { await delay(); return clone(store().incidents) },
  async getPricing() { await delay(); return clone(store().pricing) },
  async getAdmins() { await delay(); return clone(store().admins) },

  async signInRider({ phone, name, consent, joinCode }) {
    await delay(300)
    const normalized = normalizePhone(phone)
    if (!normalized) throw new Error("Enter a valid Rwandan mobile number")
    const s = store()
    const existing = s.riders.find((rider) => normalizePhone(rider.phone) === normalized)
    let company: string | undefined
    if (joinCode) {
      const match = s.companies.find((item) => item.joinCode.toLowerCase() === joinCode.trim().toLowerCase() && item.status === "active")
      if (!match) throw new Error("That company code was not found")
      company = match.id
    }
    if (existing) {
      if (company) existing.companyId = company
      commit(["riders"])
      return clone(existing)
    }
    if (!name?.trim()) throw new Error("Enter your name to create your account")
    if (!consent) throw new Error("Accept the Terms and Privacy Policy to continue")
    const rider = newRider(normalized, name.trim(), company)
    s.riders.unshift(rider)
    commit(["riders"])
    return clone(rider)
  },

  async updateRider(riderId, update) {
    await delay()
    const rider = store().riders.find((item) => item.id === riderId)
    if (!rider) throw new Error("Rider not found")
    Object.assign(rider, update)
    commit(["riders"])
    return clone(rider)
  },

  async quoteTrip(input) {
    await delay(120)
    return quote(input)
  },

  async createBooking(input) {
    await delay(400)
    const s = store()
    const rider = s.riders.find((item) => item.id === input.riderId)
    if (!rider) throw new Error("Rider not found")
    if (input.pickup === input.dropoff && input.type !== "hourly" && input.type !== "daily") throw new FareError("Choose different pickup and drop-off places")
    if ((input.type === "shared_commute" || input.paymentMethod === "company_account") && !rider.companyId) throw new Error("Only company staff can book this")
    const paymentMethod = input.type === "shared_commute" ? "company_account" : input.paymentMethod
    // The fare is calculated here from the active plan, never taken from the screen.
    const priced = quote(input)
    const firm = findFirm(priced.firmId)
    const now = nowIso()
    const route = input.type === "shared_commute" ? s.commuteRoutes.find((item) => item.companyId === rider.companyId && item.stops.includes(input.pickup) && item.stops.includes(input.dropoff)) : undefined
    const trip: Trip = {
      id: `FLT-${Date.now().toString().slice(-6)}`,
      type: input.type,
      riderId: rider.id,
      companyId: paymentMethod === "company_account" ? rider.companyId : undefined,
      firmId: firm.id,
      pickup: input.pickup,
      dropoff: input.dropoff,
      distanceKm: priced.distanceKm,
      hireQuantity: input.type === "hourly" || input.type === "daily" ? input.hireQuantity ?? 1 : undefined,
      scheduledFor: input.scheduledFor,
      fare: priced.fare,
      platformFee: fareSplit(priced.fare, firm.feePercent).platformFee,
      planName: priced.planName,
      status: input.scheduledFor ? "scheduled" : "requested",
      paymentMethod,
      paymentStatus: paymentMethod === "company_account" ? "billed_to_company" : "pending",
      commuteRouteId: route?.id,
      createdAt: now,
      updatedAt: now,
    }
    s.trips.unshift(trip)
    commit(["trips"])
    return clone(trip)
  },

  async assignDriver(tripId, driverId) {
    await delay()
    expireOffers()
    const trip = findTrip(tripId)
    assertMove(trip.status, "assigned")
    attach(trip, findDriver(driverId))
    move(trip, "assigned")
    commit(["trips", "drivers", "cars", "offers"])
    return clone(trip)
  },

  async reassignDriver(tripId, driverId) {
    await delay()
    const trip = findTrip(tripId)
    if (!reassignableStatuses.includes(trip.status)) throw new Error("This trip can no longer be reassigned")
    if (trip.driverId === driverId) throw new Error("This driver already has the trip")
    const next = findDriver(driverId)
    checkDriverCanTake(trip, next)
    for (const offer of store().offers) if (offer.tripId === trip.id && offer.status === "pending") offer.status = "expired"
    release(trip)
    // Back to assigned for the new driver, who gets a fresh offer.
    trip.status = "assigned"
    trip.acceptedAt = undefined
    attach(trip, next)
    trip.updatedAt = nowIso()
    commit(["trips", "drivers", "cars", "offers"])
    return clone(trip)
  },

  async respondOffer(offerId, accept) {
    await delay()
    const offer = store().offers.find((item) => item.id === offerId)
    if (!offer) throw new Error("Offer not found")
    if (offer.status !== "pending" || Date.parse(offer.expiresAt) <= Date.now()) {
      expireOffers()
      throw new Error("This offer has expired")
    }
    const trip = findTrip(offer.tripId)
    if (accept) {
      move(trip, "driver_arriving")
      offer.status = "accepted"
      trip.acceptedAt = nowIso()
    } else {
      offer.status = "declined"
      backToQueue(trip)
    }
    commit(["trips", "offers", "drivers", "cars"])
    return clone(trip)
  },

  async driverArrived(tripId) {
    await delay()
    const trip = findTrip(tripId)
    move(trip, "driver_arrived")
    trip.arrivedAt = nowIso()
    commit(["trips"])
    return clone(trip)
  },

  async startTrip(tripId) {
    await delay()
    const trip = findTrip(tripId)
    move(trip, "in_progress")
    trip.startedAt = nowIso()
    commit(["trips"])
    return clone(trip)
  },

  async endTrip(tripId) {
    await delay()
    const trip = findTrip(tripId)
    move(trip, "completed")
    trip.completedAt = nowIso()
    // Demo EBM receipt number. In production the firm's EBM system issues it.
    trip.receiptNo = `EBM-${trip.completedAt.slice(0, 4)}-${String(Math.floor(10000 + Math.random() * 89999))}`
    release(trip)
    commit(["trips", "drivers", "cars"])
    return clone(trip)
  },

  async cancelTrip(tripId, by, reason) {
    await delay()
    if (!reason.trim()) throw new Error("Choose a reason")
    const trip = findTrip(tripId)
    // Ops cancels on the rider's behalf, so it uses the rider-cancel status; cancelledBy records who did it.
    const status: TripStatus = by === "driver" ? "cancelled_by_driver" : "cancelled_by_rider"
    move(trip, status)
    for (const offer of store().offers) if (offer.tripId === trip.id && offer.status === "pending") offer.status = "expired"
    release(trip)
    trip.cancelledAt = nowIso()
    trip.cancelledBy = by
    trip.cancelReason = reason.trim()
    commit(["trips", "drivers", "cars", "offers"])
    return clone(trip)
  },

  async markNoDriverFound(tripId) {
    await delay()
    const trip = findTrip(tripId)
    move(trip, "no_driver_found")
    trip.cancelledAt = nowIso()
    trip.cancelledBy = "system"
    trip.cancelReason = "No driver accepted"
    commit(["trips"])
    return clone(trip)
  },

  async riderMarkPaid(tripId) {
    await delay()
    const trip = findTrip(tripId)
    if (trip.status !== "completed") throw new Error("Pay after the trip ends")
    if (trip.paymentMethod === "company_account") throw new Error("This trip is billed to your company")
    if (trip.paymentStatus === "paid") return clone(trip)
    trip.riderPaidAt = nowIso()
    trip.paymentStatus = "pending"
    trip.updatedAt = nowIso()
    commit(["trips"])
    return clone(trip)
  },

  async confirmPayment(tripId, received) {
    await delay()
    const trip = findTrip(tripId)
    if (trip.status !== "completed" || trip.paymentMethod === "company_account") throw new Error("Nothing to confirm for this trip")
    trip.paymentStatus = received ? "paid" : "failed"
    trip.paidAt = received ? nowIso() : undefined
    trip.updatedAt = nowIso()
    commit(["trips"])
    return clone(trip)
  },

  async rateTrip(tripId, rating, tags, comment) {
    await delay()
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new Error("Rating must be 1 to 5 stars")
    const trip = findTrip(tripId)
    if (trip.status !== "completed") throw new Error("Rate after the trip ends")
    trip.riderRating = rating
    trip.ratingTags = tags?.length ? tags : undefined
    trip.ratingComment = comment?.trim() || undefined
    commit(["trips"])
    return clone(trip)
  },

  async rateRider(tripId, rating) {
    await delay()
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new Error("Rating must be 1 to 5 stars")
    const trip = findTrip(tripId)
    if (trip.status !== "completed") throw new Error("Rate after the trip ends")
    trip.driverRating = rating
    commit(["trips"])
    return clone(trip)
  },

  async setDriverPresence(driverId, presence) {
    await delay()
    const driver = findDriver(driverId)
    if (driver.status === "on_trip") throw new Error("Finish the current trip first")
    if (presence === "online" && driver.approval !== "approved") throw new Error("Your account is not approved yet")
    driver.status = presence
    commit(["drivers"])
    return clone(driver)
  },

  async setActivePlan(name) {
    await delay()
    const pricing = store().pricing
    if (!pricing.plans.some((plan) => plan.name === name)) throw new Error("Unknown plan")
    for (const plan of pricing.plans) plan.isActive = plan.name === name
    commit(["pricing"])
    return clone(pricing)
  },

  async updatePlan(name, values) {
    await delay()
    const plan = store().pricing.plans.find((item) => item.name === name)
    if (!plan) throw new Error("Unknown plan")
    for (const [key, value] of Object.entries(values)) if (value != null && (!Number.isInteger(value) || value < 0)) throw new Error(`${key} must be a whole number`)
    Object.assign(plan, values)
    commit(["pricing"])
    return clone(store().pricing)
  },

  async updateAirportZones(zones) {
    await delay()
    for (const zone of zones) if (zone.price != null && (!Number.isInteger(zone.price) || zone.price <= 0)) throw new Error("Zone prices must be whole Rwf amounts")
    store().pricing.airportZones = zones
    commit(["pricing"])
    return clone(store().pricing)
  },

  async setFirmFee(firmId, feePercent) {
    await delay()
    if (![10, 12, 15].includes(feePercent)) throw new Error("Fee must be 10, 12 or 15%")
    const firm = findFirm(firmId)
    firm.feePercent = feePercent
    commit(["firms"])
    return clone(firm)
  },

  async reportIncident(input) {
    await delay()
    const incident = { id: `INC-${Date.now().toString().slice(-5)}`, status: "open" as const, notes: [], createdAt: nowIso(), ...input }
    store().incidents.unshift(incident)
    commit(["incidents"])
    return clone(incident)
  },

  async resetDemo() {
    await delay()
    db = buildSeed()
    commit(["firms", "companies", "riders", "drivers", "cars", "trips", "offers", "routes", "invoices", "incidents", "pricing", "admins"])
  },
}

/** Test helper: start from a fresh seed. */
export function __resetMockStore(seed?: MockDb) {
  db = seed ?? buildSeed()
}

