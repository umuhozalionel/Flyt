import { offerSeconds } from "../config"
import { documentBlocks } from "../documents"
import { riderForDriver } from "../driver"
import { kmBetween, pickupEtas, pickupMinutes } from "../eta"
import { makeJoinCode } from "../company"
import { canInvoicePeriod, generateInvoices, nextInvoiceStatus } from "../invoices"
import { kigaliDay } from "../time"
import { buildDocuments, isWholeRwf, normalizePlate } from "../fleet"
import { normalizePhone } from "../format"
import { feePercentOf } from "../ops"
import { buildSeed, SEED_VERSION, type MockDb } from "../mock-data"
import { FareError, fareSplit, firmsOffering, quoteFare } from "../pricing"
import { assertMove, reassignableStatuses } from "../trip-rules"
import { bonusProgress, busyAreas, chatOpen, chatRole, checkTipAmount, defaultSettings, hasPhoneNumber, HEADING_HOME_MAX_HOURS, isVerifiedRider, LOST_ITEM_CHAT_HOURS, LOST_ITEM_DAYS, newPin, PIN_MAX_TRIES, rewardPoints, tipOpen } from "../additions"
import { seedPin } from "../mock-data"
import { hashOf } from "../map"
import type { AdminUser, AppNotification, Car, Company, Driver, Firm, NotificationType, Rider, Trip, TripStatus, Viewer } from "../types"
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

// ── Notifications (Phase 6B). The same events and texts as the Postgres triggers. ─────────
const viewerKey = (viewer: Viewer) => `${viewer.kind}:${viewer.id}`

function notify(to: string | undefined, type: NotificationType, title: string, body: string, dedupe: string, tripId?: string) {
  if (!to) return
  const s = store()
  if ((s.mutes[to] ?? []).includes(type)) return
  if (s.notifications.some((item) => item.to === to && item.id === `${to}|${dedupe}`)) return
  s.notifications.unshift({ id: `${to}|${dedupe}`, to, type, title, body, tripId, createdAt: nowIso() })
  // Keep the demo store small.
  if (s.notifications.length > 400) s.notifications.length = 400
}

const riderKey = (trip: Trip) => `rider:${trip.riderId}`
const driverKey = (driverId?: string) => (driverId ? `driver:${driverId}` : undefined)
const firstNameOf = (driverId?: string) => store().drivers.find((item) => item.id === driverId)?.name.split(/\s+/)[0] ?? "Your driver"

/** Admins to tell about a trip: firm admins of its firm, and company admins of a company-billed trip (rule b). */
function adminKeysFor(trip: Trip | undefined) {
  if (!trip) return []
  return store()
    .admins.filter((admin) => (admin.role === "firm_admin" && admin.firmId === trip.firmId) || (admin.role === "company_admin" && !!trip.companyId && admin.companyId === trip.companyId))
    .map((admin) => `admin:${admin.id}`)
}

const endedStatuses: TripStatus[] = ["completed", "cancelled_by_rider", "cancelled_by_driver", "no_driver_found"]

function tripEvent(trip: Trip, to: TripStatus) {
  const name = firstNameOf(trip.driverId)
  if (to === "driver_arriving") notify(riderKey(trip), "driver_assigned", "Driver on the way", `${name} accepted your ride.`, `trip:${trip.id}:assigned`, trip.id)
  if (to === "driver_arrived") notify(riderKey(trip), "driver_arrived", "Your driver is here", `${name} has arrived at the pickup.`, `trip:${trip.id}:arrived`, trip.id)
  if (to === "in_progress") notify(riderKey(trip), "trip_started", "Trip started", "Have a good ride.", `trip:${trip.id}:started`, trip.id)
  if (to === "completed") notify(riderKey(trip), "receipt_ready", "Receipt ready", `Your receipt for trip ${trip.id} is ready.`, `trip:${trip.id}:receipt`, trip.id)
  if (to === "cancelled_by_rider") notify(driverKey(trip.driverId), "trip_cancelled_by_rider", "Trip cancelled", `The rider cancelled trip ${trip.id}.`, `trip:${trip.id}:cancelled`, trip.id)
  // Trip ended: sharing links stop working.
  if (endedStatuses.includes(to)) for (const share of store().shares) if (share.tripId === trip.id && !share.revokedAt) share.revokedAt = nowIso()
}

/** Time-based notices, like app.run_reminders in Postgres. Each is sent once. */
function runReminders(now = Date.now()) {
  const s = store()
  const remind = s.settings.scheduledReminderMinutes * 60_000
  const today = kigaliDay(new Date(now))
  for (const trip of s.trips) {
    if (trip.scheduledFor && ["scheduled", "assigned", "driver_arriving"].includes(trip.status)) {
      const at = Date.parse(trip.scheduledFor)
      if (at >= now && at <= now + remind) {
        const time = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Kigali", hour: "2-digit", minute: "2-digit" }).format(new Date(at))
        notify(riderKey(trip), "scheduled_reminder", "Ride soon", `Your scheduled ride is at ${time}.`, `trip:${trip.id}:reminder`, trip.id)
        notify(driverKey(trip.driverId), "scheduled_reminder", "Scheduled ride soon", `Pickup at ${time}.`, `trip:${trip.id}:reminder`, trip.id)
      }
    }
    if (trip.status === "driver_arriving" && trip.acceptedAt) {
      const driver = s.drivers.find((item) => item.id === trip.driverId)
      const eta = driver ? pickupMinutes(kmBetween(driver.zone, trip.pickup)) : undefined
      if (eta != null && Date.parse(trip.acceptedAt) + Math.max(eta - 2, 0) * 60_000 <= now) notify(riderKey(trip), "driver_arriving", "Driver almost there", "About 2 minutes away.", `trip:${trip.id}:arriving`, trip.id)
    }
    if (trip.status === "requested" && Date.parse(trip.createdAt) < now - s.settings.requestWaitingMinutes * 60_000) {
      for (const key of adminKeysFor(trip)) notify(key, "request_waiting", "Request waiting", `Trip ${trip.id} has waited over ${s.settings.requestWaitingMinutes} minutes for a driver.`, `trip:${trip.id}:waiting`, trip.id)
    }
  }
  const in30 = kigaliDay(new Date(Date.parse(`${today}T12:00:00Z`) + 30 * 86_400_000))
  const in7 = kigaliDay(new Date(Date.parse(`${today}T12:00:00Z`) + 7 * 86_400_000))
  for (const driver of s.drivers) {
    const car = s.cars.find((item) => item.id === driver.carId)
    for (const doc of [...driver.documents, ...(car?.documents ?? [])]) {
      if (doc.review !== "on_file" || !doc.expiryDate) continue
      if (doc.expiryDate === in30 || doc.expiryDate === in7) {
        const days = doc.expiryDate === in30 ? 30 : 7
        notify(`driver:${driver.id}`, days === 30 ? "document_expiring_30" : "document_expiring_7", "Document expiring", `${doc.type.replace(/_/g, " ")} expires on ${doc.expiryDate}.`, `doc:${doc.id}:expiry:${doc.expiryDate}:${days}`)
      }
    }
  }
}

/** Mock rule for dispatch: the open queue is for platform admins; a firm admin reassigns trips already given to their firm. */
function checkDispatch(trip: Trip, driver: Driver, byAdminId?: string) {
  if (!byAdminId) return
  const admin = store().admins.find((item) => item.id === byAdminId)
  if (!admin || admin.role === "platform_admin") return
  const current = store().drivers.find((item) => item.id === trip.driverId)
  if (admin.role === "firm_admin" && current?.firmId === admin.firmId && driver.firmId === admin.firmId) return
  throw new Error("The open queue is for Flyt Operations. You can reassign trips already given to your firm, to your own drivers")
}

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
  tripEvent(trip, to)
}

/** Free the driver and car attached to a trip. */
function release(trip: Trip) {
  if (!trip.driverId) return
  const driver = store().drivers.find((item) => item.id === trip.driverId)
  if (driver && driver.status === "on_trip") driver.status = "online"
  if (driver?.suspendAfterTrip) {
    driver.approval = "suspended"
    driver.status = "offline"
    driver.suspendAfterTrip = undefined
    notify(`driver:${driver.id}`, "account_suspended", "Account suspended", "Contact your firm or Flyt Operations.", `approval:${driver.id}:${nowIso()}`)
  }
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
  if (changed) commit(["notifications", "offers", "trips", "drivers", "cars"])
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
  const offerId = `offer-${now}-${driver.id}`
  store().offers.push({ id: offerId, tripId: trip.id, driverId: driver.id, status: "pending", createdAt: new Date(now).toISOString(), expiresAt: new Date(now + offerSeconds * 1000).toISOString() })
  notify(`driver:${driver.id}`, "offer_new", "New trip offer", `You have ${offerSeconds} seconds to accept.`, `offer:${offerId}`, trip.id)
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

  async requestSignInCode(phone) {
    await delay(200)
    if (!normalizePhone(phone)) throw new Error("Enter a valid Rwandan mobile number")
    // Demo data: no SMS is sent and any 6-digit code works.
    return { sent: true }
  },

  async signInAdmin({ phone, portal }) {
    await delay(300)
    const normalized = normalizePhone(phone)
    if (!normalized) throw new Error("Enter a valid Rwandan mobile number")
    const roles = portal === "ops" ? ["platform_admin", "firm_admin"] : ["company_admin"]
    const found = store().admins.filter((admin) => normalizePhone(admin.phone) === normalized && roles.includes(admin.role))
    if (!found.length) throw new Error("This number has no access here")
    return clone(found)
  },

  async getSignedInAdmins() {
    return []
  },

  async signOut() {},

  async getDocumentFileUrl() {
    // The demo keeps no files; they are stored only with Supabase.
    return undefined
  },

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
      // Staff added by their company admin accept the Terms on their first sign-in.
      if (!existing.consentAt) {
        if (!consent) throw new Error("Accept the Terms and Privacy Policy to continue")
        existing.consentAt = nowIso()
      }
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

  async getPickupEtas(pickup, types) {
    await delay(120)
    expireOffers()
    const s = store()
    return pickupEtas(pickup, types, s.drivers, s.cars, s.firms)
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
    s.pins[trip.id] = { pin: newPin(), wrongTries: 0 }
    commit(["notifications", "trips"])
    return clone(trip)
  },

  async assignDriver(tripId, driverId, byAdminId) {
    await delay()
    expireOffers()
    const trip = findTrip(tripId)
    const driver = findDriver(driverId)
    checkDispatch(trip, driver, byAdminId)
    assertMove(trip.status, "assigned")
    attach(trip, driver)
    move(trip, "assigned")
    commit(["notifications", "trips", "drivers", "cars", "offers"])
    return clone(trip)
  },

  async reassignDriver(tripId, driverId, byAdminId) {
    await delay()
    const trip = findTrip(tripId)
    if (!reassignableStatuses.includes(trip.status)) throw new Error("This trip can no longer be reassigned")
    if (trip.driverId === driverId) throw new Error("This driver already has the trip")
    const next = findDriver(driverId)
    checkDispatch(trip, next, byAdminId)
    checkDriverCanTake(trip, next)
    for (const offer of store().offers) if (offer.tripId === trip.id && offer.status === "pending") offer.status = "expired"
    release(trip)
    // Back to assigned for the new driver, who gets a fresh offer.
    trip.status = "assigned"
    trip.acceptedAt = undefined
    attach(trip, next)
    trip.updatedAt = nowIso()
    commit(["notifications", "trips", "drivers", "cars", "offers"])
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
    commit(["notifications", "trips", "offers", "drivers", "cars"])
    return clone(trip)
  },

  async driverArrived(tripId) {
    await delay()
    const trip = findTrip(tripId)
    move(trip, "driver_arrived")
    trip.arrivedAt = nowIso()
    commit(["notifications", "trips"])
    return clone(trip)
  },

  async startTrip(tripId, pin) {
    await delay()
    const trip = findTrip(tripId)
    if (!pin || !/^\d{4}$/.test(pin)) throw new Error("Enter the rider's 4-digit trip PIN")
    const s = store()
    const entry = (s.pins[trip.id] ??= { pin: seedPin(trip.id), wrongTries: 0 })
    if (entry.wrongTries >= PIN_MAX_TRIES) throw new Error("Too many wrong PINs. Call Flyt Operations to start this trip")
    if (entry.pin !== pin) {
      entry.wrongTries += 1
      commit(["notifications", "trips"])
      throw new Error("That PIN is not right. Ask the rider for the PIN in their app")
    }
    move(trip, "in_progress")
    trip.startedAt = nowIso()
    commit(["notifications", "trips"])
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
    commit(["notifications", "trips", "drivers", "cars"])
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
    commit(["notifications", "trips", "drivers", "cars", "offers"])
    return clone(trip)
  },

  async markNoDriverFound(tripId) {
    await delay()
    const trip = findTrip(tripId)
    move(trip, "no_driver_found")
    trip.cancelledAt = nowIso()
    trip.cancelledBy = "system"
    trip.cancelReason = "No driver accepted"
    commit(["notifications", "trips"])
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
    commit(["notifications", "trips"])
    return clone(trip)
  },

  async confirmPayment(tripId, received) {
    await delay()
    const trip = findTrip(tripId)
    if (trip.status !== "completed" || trip.paymentMethod === "company_account") throw new Error("Nothing to confirm for this trip")
    trip.paymentStatus = received ? "paid" : "failed"
    trip.paidAt = received ? nowIso() : undefined
    if (received) notify(driverKey(trip.driverId), "payment_confirmed", "Payment confirmed", `Payment for trip ${trip.id} is confirmed.`, `trip:${trip.id}:paid`, trip.id)
    trip.updatedAt = nowIso()
    commit(["notifications", "trips"])
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
    commit(["notifications", "trips"])
    return clone(trip)
  },

  async rateRider(tripId, rating) {
    await delay()
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new Error("Rating must be 1 to 5 stars")
    const trip = findTrip(tripId)
    if (trip.status !== "completed") throw new Error("Rate after the trip ends")
    trip.driverRating = rating
    commit(["notifications", "trips"])
    return clone(trip)
  },

  async addFirm(input) {
    await delay()
    const s = store()
    const name = input.name.trim()
    if (!name) throw new Error("Enter the firm name")
    if (!input.ruraLicenceNo.trim()) throw new Error("Enter the RURA licence number")
    if (!/^\d{9}$/.test(input.tin.trim())) throw new Error("TIN must be 9 digits")
    if (!input.momoMerchantCode.trim() || !input.airtelMerchantCode.trim()) throw new Error("Enter both merchant codes")
    if (![10, 12, 15].includes(input.feePercent)) throw new Error("Fee must be 10, 12 or 15%")
    for (const rate of [input.hourlyRate, input.dailyRate]) if (rate != null && !isWholeRwf(rate)) throw new Error("Rates must be whole Rwf amounts")
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.licenceExpiry)) throw new Error("Enter the licence expiry date")
    if (s.firms.some((firm) => firm.ruraLicenceNo.toLowerCase() === input.ruraLicenceNo.trim().toLowerCase())) throw new Error("A firm with this licence number already exists")
    const firm: Firm = { ...input, id: `firm-${Date.now()}`, name, ruraLicenceNo: input.ruraLicenceNo.trim(), tin: input.tin.trim(), momoMerchantCode: input.momoMerchantCode.trim(), airtelMerchantCode: input.airtelMerchantCode.trim() }
    s.firms.push(firm)
    commit(["firms"])
    return clone(firm)
  },

  async addDriver(input) {
    await delay()
    const s = store()
    const name = input.name.trim()
    if (!name) throw new Error("Enter the driver's name")
    const phone = normalizePhone(input.phone)
    if (!phone) throw new Error("Enter a valid Rwandan mobile number")
    if (s.drivers.some((driver) => normalizePhone(driver.phone) === phone)) throw new Error("A driver with this phone number already exists")
    findFirm(input.firmId)
    if (input.carId) {
      const car = s.cars.find((item) => item.id === input.carId)
      if (!car || car.firmId !== input.firmId) throw new Error("Pick a car from the same firm")
      if (s.drivers.some((driver) => driver.carId === car.id)) throw new Error("This car already has a driver")
    }
    const id = `driver-${Date.now()}`
    // New drivers start pending until Flyt Operations checks their documents.
    const driver: Driver = { id, firmId: input.firmId, name, phone, rating: 5, status: "offline", approval: "pending", zone: input.zone, carId: input.carId, documents: buildDocuments(id, "driver", input.documents) }
    s.drivers.push(driver)
    commit(["drivers"])
    return clone(driver)
  },

  async addCar(input) {
    await delay()
    const s = store()
    const plate = normalizePlate(input.plate)
    if (!plate) throw new Error("Plate must look like RAB 123 C")
    if (s.cars.some((car) => car.plate === plate)) throw new Error("A car with this plate already exists")
    findFirm(input.firmId)
    if (!input.make.trim() || !input.model.trim() || !input.colour.trim()) throw new Error("Enter the make, model and colour")
    const thisYear = new Date().getFullYear()
    if (!Number.isInteger(input.year) || input.year < 2000 || input.year > thisYear + 1) throw new Error(`Year must be between 2000 and ${thisYear + 1}`)
    if (!Number.isInteger(input.seats) || input.seats < 1 || input.seats > 8) throw new Error("Seats must be 1 to 8")
    const id = `car-${Date.now()}`
    const car: Car = { id, firmId: input.firmId, plate, make: input.make.trim(), model: input.model.trim(), colour: input.colour.trim(), year: input.year, seats: input.seats, power: input.power, availability: "available", zone: input.zone, documents: buildDocuments(id, "car", input.documents) }
    s.cars.push(car)
    commit(["cars"])
    return clone(car)
  },

  async setDriverApproval(driverId, approval) {
    await delay()
    const driver = findDriver(driverId)
    if (approval === "suspended" && driver.status === "on_trip") {
      // Never stop a trip midway: the suspension takes effect when the current trip ends.
      driver.suspendAfterTrip = true
      commit(["drivers"])
      return clone(driver)
    }
    if (approval === "suspended") driver.status = "offline"
    if (approval === "approved" && driver.documents.some((doc) => documentBlocks(doc))) throw new Error("Expired, missing or rejected documents must be fixed before approval")
    if (driver.approval !== approval) {
      if (approval === "approved") notify(`driver:${driver.id}`, "account_approved", "Account approved", "You can go online now.", `approval:${driver.id}:${nowIso()}`)
      else notify(`driver:${driver.id}`, "account_suspended", "Account suspended", "Contact your firm or Flyt Operations.", `approval:${driver.id}:${nowIso()}`)
    }
    driver.approval = approval
    commit(["drivers", "notifications"])
    return clone(driver)
  },

  async reviewDocument({ adminId, owner, ownerId, type, decision, reason }) {
    await delay()
    const s = store()
    const admin = s.admins.find((item) => item.id === adminId)
    if (admin?.role !== "platform_admin") throw new Error("Only platform admins can approve or reject documents")
    const holder = owner === "driver" ? s.drivers.find((item) => item.id === ownerId) : s.cars.find((item) => item.id === ownerId)
    if (!holder) throw new Error(owner === "driver" ? "Driver not found" : "Car not found")
    const doc = holder.documents.find((item) => item.type === type)
    if (!doc) throw new Error("Unknown document")
    if (doc.review !== "pending_review") throw new Error("This document is not waiting for review")
    if (decision === "reject") {
      if (!reason?.trim()) throw new Error("Give a reason the driver can act on")
      doc.review = "rejected"
      doc.rejectReason = reason.trim().slice(0, 200)
    } else {
      if (type !== "national_id" && doc.expiryDate && doc.expiryDate < kigaliDay()) throw new Error("This document has already expired")
      doc.review = "on_file"
      doc.rejectReason = undefined
    }
    const who = owner === "driver" ? ownerId : s.drivers.find((item) => item.carId === ownerId)?.id
    const label = type.replace(/_/g, " ")
    if (decision === "reject") notify(driverKey(who), "document_rejected", "Document rejected", doc.rejectReason ?? "Send a new one.", `doc:${doc.id}:${nowIso()}`)
    else notify(driverKey(who), "document_approved", "Document approved", `${label} was approved.`, `doc:${doc.id}:${nowIso()}`)
    // A driver who was online with a document that is now rejected goes offline.
    if (owner === "driver" && decision === "reject") {
      const driver = holder as Driver
      if (driver.status === "online") driver.status = "offline"
    }
    commit([owner === "driver" ? "drivers" : "cars"])
    return clone(doc)
  },

  async addCompany(input) {
    await delay()
    const s = store()
    const name = input.name.trim()
    if (!name) throw new Error("Enter the company name")
    if (!input.contactName.trim()) throw new Error("Enter the contact person")
    const phone = normalizePhone(input.phone)
    if (!phone) throw new Error("Enter a valid Rwandan mobile number")
    if (!Number.isInteger(input.staffCount) || input.staffCount < 1) throw new Error("Staff count must be a whole number")
    if (s.companies.some((item) => item.name.toLowerCase() === name.toLowerCase())) throw new Error("A company with this name already exists")
    const taken = s.companies.map((item) => item.joinCode)
    const joinCode = input.joinCode?.trim().toUpperCase() || makeJoinCode(name, taken)
    if (!/^[A-Z0-9-]{4,20}$/.test(joinCode)) throw new Error("Join code: 4 to 20 letters, digits or dashes")
    if (taken.some((code) => code.toLowerCase() === joinCode.toLowerCase())) throw new Error("This join code is already used")
    const company: Company = { id: `co-${Date.now()}`, name, contactName: input.contactName.trim(), phone, staffCount: input.staffCount, status: input.status, joinCode }
    s.companies.push(company)
    commit(["companies"])
    return clone(company)
  },

  async addStaff(companyId, input) {
    await delay()
    const s = store()
    const company = s.companies.find((item) => item.id === companyId)
    if (!company) throw new Error("Company not found")
    const phone = normalizePhone(input.phone)
    if (!phone) throw new Error("Enter a valid Rwandan mobile number")
    const existing = s.riders.find((rider) => normalizePhone(rider.phone) === phone)
    if (existing) {
      if (existing.companyId === companyId) throw new Error("This person is already on your staff list")
      if (existing.companyId) throw new Error("This person is linked to another company")
      existing.companyId = companyId
      commit(["riders"])
      return clone(existing)
    }
    if (!input.name.trim()) throw new Error("Enter the person's name")
    // Their account is ready; they accept the Terms when they first sign in with this number.
    const rider: Rider = { ...newRider(phone, input.name.trim(), companyId), consentAt: undefined }
    s.riders.unshift(rider)
    commit(["riders"])
    return clone(rider)
  },

  async removeStaff(companyId, riderId) {
    await delay()
    const s = store()
    const rider = s.riders.find((item) => item.id === riderId)
    if (!rider || rider.companyId !== companyId) throw new Error("This person is not on your staff list")
    rider.companyId = undefined
    for (const route of s.commuteRoutes) if (route.companyId === companyId) route.riderIds = route.riderIds.filter((id) => id !== riderId)
    commit(["riders", "routes"])
    return clone(rider)
  },

  async generateInvoices(period) {
    await delay(300)
    if (!canInvoicePeriod(period)) throw new Error("Pick this month or an earlier month")
    const s = store()
    const result = generateInvoices(period, s.firms, s.companies, s.trips, s.feeInvoices, s.companyInvoices)
    s.feeInvoices = result.feeInvoices
    s.companyInvoices = result.companyInvoices
    commit(["invoices"])
    return { period, created: result.created, refreshed: result.refreshed }
  },

  async setInvoiceStatus(kind, invoiceId, status) {
    await delay()
    const s = store()
    const invoice = kind === "fee" ? s.feeInvoices.find((item) => item.id === invoiceId) : s.companyInvoices.find((item) => item.id === invoiceId)
    if (!invoice) throw new Error("Invoice not found")
    if (nextInvoiceStatus[invoice.status] !== status) throw new Error("Invoices move from draft to sent to paid")
    if (status === "sent") {
      const owners = s.admins.filter((admin) => ("firmId" in invoice ? admin.firmId === invoice.firmId : admin.companyId === invoice.companyId))
      for (const admin of owners) notify(`admin:${admin.id}`, "invoice_sent", "Invoice sent", `Invoice ${invoice.id} for ${invoice.period} is ready.`, `invoice:${invoice.id}`)
    }
    invoice.status = status
    commit(["invoices", "notifications"])
    return clone(invoice)
  },

  async correctTripFare({ adminId, tripId, fare, reason }) {
    await delay()
    const s = store()
    const admin = s.admins.find((item) => item.id === adminId)
    if (admin?.role !== "platform_admin") throw new Error("Only platform admins can correct a fare")
    const trip = findTrip(tripId)
    if (trip.status !== "completed") throw new Error("Only a completed trip's fare can be corrected")
    if (!Number.isInteger(fare) || fare < 0) throw new Error("The fare must be a whole Rwf amount (0 voids the trip)")
    if (fare === trip.fare) throw new Error("The fare is already this amount")
    if (!reason.trim()) throw new Error("Give a reason for the correction")
    // The fee rate stays the one the trip was booked at.
    const percent = trip.corrections?.[0]?.feePercent ?? feePercentOf(trip)
    trip.corrections = [...(trip.corrections ?? []), { at: nowIso(), byAdminId: adminId, fromFare: trip.fare, toFare: fare, reason: reason.trim().slice(0, 200), feePercent: percent }]
    trip.fare = fare
    trip.platformFee = fareSplit(fare, percent).platformFee
    trip.updatedAt = nowIso()
    commit(["notifications", "trips"])
    return clone(trip)
  },

  async addAdmin(input) {
    await delay()
    const s = store()
    const name = input.name.trim()
    if (!name) throw new Error("Enter the person's name")
    const phone = normalizePhone(input.phone)
    if (!phone) throw new Error("Enter a valid Rwandan mobile number")
    if (s.admins.some((admin) => normalizePhone(admin.phone) === phone && admin.role === input.role)) throw new Error("This person already has this role")
    if (input.role === "firm_admin" && !s.firms.some((firm) => firm.id === input.firmId)) throw new Error("Pick the firm")
    if (input.role === "company_admin" && !s.companies.some((company) => company.id === input.companyId)) throw new Error("Pick the company")
    const admin: AdminUser = { id: `admin-${Date.now()}`, name, phone, role: input.role, firmId: input.role === "firm_admin" ? input.firmId : undefined, companyId: input.role === "company_admin" ? input.companyId : undefined }
    s.admins.push(admin)
    commit(["admins"])
    return clone(admin)
  },

  async removeAdmin(adminId, byAdminId) {
    await delay()
    const s = store()
    const by = s.admins.find((item) => item.id === byAdminId)
    if (by?.role !== "platform_admin") throw new Error("Only platform admins can change the team")
    if (adminId === byAdminId) throw new Error("You cannot remove yourself")
    const admin = s.admins.find((item) => item.id === adminId)
    if (!admin) throw new Error("Team member not found")
    if (admin.role === "platform_admin" && s.admins.filter((item) => item.role === "platform_admin").length <= 1) throw new Error("Keep at least one platform admin")
    s.admins = s.admins.filter((item) => item.id !== adminId)
    commit(["admins"])
  },

  async signInDriver({ phone }) {
    await delay(300)
    const normalized = normalizePhone(phone)
    if (!normalized) throw new Error("Enter a valid Rwandan mobile number")
    const driver = store().drivers.find((item) => normalizePhone(item.phone) === normalized)
    if (!driver) throw new Error("This number is not registered with a Flyt partner firm")
    return clone(driver)
  },

  async getDriverTrips(driverId) {
    await delay()
    expireOffers()
    return clone(store().trips.filter((trip) => trip.driverId === driverId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
  },

  async getDriverJob(tripId, driverId) {
    await delay()
    expireOffers()
    const s = store()
    const trip = s.trips.find((item) => item.id === tripId)
    // A driver sees a trip only while it is theirs, or once they drove it.
    if (!trip || trip.driverId !== driverId) return undefined
    const rider = s.riders.find((item) => item.id === trip.riderId)
    const forDriver = { ...riderForDriver(trip, rider, s.trips.filter((item) => item.riderId === trip.riderId)), verified: isVerifiedRider(rider, s.companies) }
    return clone({ trip, rider: forDriver, car: s.cars.find((item) => item.id === trip.carId), firm: s.firms.find((item) => item.id === trip.firmId) })
  },

  async submitDocument(driverId, type, expiryDate) {
    await delay()
    const driver = findDriver(driverId)
    const doc = driver.documents.find((item) => item.type === type)
    if (!doc) throw new Error("Unknown document")
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expiryDate) && type !== "national_id") throw new Error("Enter the expiry date")
    if (type !== "national_id" && expiryDate < kigaliDay()) throw new Error("This document has already expired")
    doc.review = "pending_review"
    doc.rejectReason = undefined
    if (type !== "national_id") doc.expiryDate = expiryDate
    commit(["drivers"])
    return clone(driver)
  },

  async setDriverPresence(driverId, presence) {
    await delay()
    const driver = findDriver(driverId)
    if (driver.status === "on_trip") throw new Error("Finish the current trip first")
    if (presence === "online" && driver.approval !== "approved") throw new Error("Your account is not approved yet")
    if (presence === "online" && driver.documents.some((doc) => documentBlocks(doc))) throw new Error("A document is expired, missing or rejected. Send a new one before going online")
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

  async setFirmRates(firmId, rates) {
    await delay()
    for (const rate of [rates.hourlyRate, rates.dailyRate]) if (rate != null && !isWholeRwf(rate)) throw new Error("Rates must be whole Rwf amounts")
    const firm = findFirm(firmId)
    // Fares already booked stay fixed; new hire bookings use the new rates.
    firm.hourlyRate = rates.hourlyRate ?? undefined
    firm.dailyRate = rates.dailyRate ?? undefined
    commit(["firms"])
    return clone(firm)
  },

  async reportIncident(input) {
    await delay()
    const incident = { id: `INC-${Date.now().toString().slice(-5)}`, status: "open" as const, notes: [], createdAt: nowIso(), ...input }
    store().incidents.unshift(incident)
    const trip = store().trips.find((item) => item.id === incident.tripId)
    for (const key of adminKeysFor(trip)) notify(key, "incident_opened", "Incident opened", incident.description.slice(0, 120), `incident:${incident.id}`, incident.tripId)
    commit(["incidents", "notifications"])
    return clone(incident)
  },

  async updateIncident(incidentId, update) {
    await delay()
    const incident = store().incidents.find((item) => item.id === incidentId)
    if (!incident) throw new Error("Incident not found")
    const note = update.note?.trim()
    if (!note && !update.status) throw new Error("Add a note or change the status")
    if (note) incident.notes.push(note.slice(0, 500))
    if (update.status) incident.status = update.status
    commit(["incidents"])
    return clone(incident)
  },


  // ── Phase 6B additions ─────────────────────────────────────────────────────────────────

  async getNotifications(viewer) {
    await delay(60)
    runReminders()
    const key = viewerKey(viewer)
    return clone(store().notifications.filter((item) => item.to === key).map((item): AppNotification => ({ id: item.id, type: item.type, title: item.title, body: item.body, link: item.link, tripId: item.tripId, createdAt: item.createdAt, readAt: item.readAt })))
  },
  async markNotificationsRead(viewer, ids) {
    const key = viewerKey(viewer)
    const at = nowIso()
    for (const item of store().notifications) if (item.to === key && !item.readAt && (!ids || ids.includes(item.id))) item.readAt = at
    commit(["notifications"])
  },
  async getNotificationMutes(viewer) {
    return clone(store().mutes[viewerKey(viewer)] ?? [])
  },
  async setNotificationMute(viewer, type, muted) {
    const s = store()
    const key = viewerKey(viewer)
    const current = new Set(s.mutes[key] ?? [])
    if (muted) current.add(type)
    else current.delete(type)
    s.mutes[key] = [...current]
    commit(["notifications"])
  },
  async savePushSubscription(viewer, subscription) {
    const s = store()
    s.pushSubscriptions = s.pushSubscriptions.filter((item) => item.endpoint !== subscription.endpoint)
    s.pushSubscriptions.push({ ...subscription, to: viewerKey(viewer) })
    commit(["notifications"])
  },
  async deletePushSubscription(endpoint) {
    const s = store()
    s.pushSubscriptions = s.pushSubscriptions.filter((item) => item.endpoint !== endpoint)
    commit(["notifications"])
  },

  async getTripPin(tripId) {
    const s = store()
    const trip = s.trips.find((item) => item.id === tripId)
    if (!trip) return undefined
    return (s.pins[trip.id] ??= { pin: seedPin(trip.id), wrongTries: 0 }).pin
  },

  async getChat(tripId, channel) {
    await delay(60)
    return clone(store().chat.filter((item) => item.tripId === tripId && item.channel === channel).sort((a, b) => a.createdAt.localeCompare(b.createdAt)))
  },
  async sendChat({ tripId, channel, body, quickReply, from }) {
    await delay(80)
    const s = store()
    const trip = findTrip(tripId)
    const text = body.trim()
    const admin = from.sender === "company" ? s.admins.find((item) => item.id === from.senderId) : undefined
    const role = chatRole(trip, channel, from.sender === "rider" ? { riderId: from.senderId } : from.sender === "driver" ? { driverId: from.senderId } : { companyId: admin?.companyId })
    if (!role) throw new Error("This is not your trip")
    if (!chatOpen(trip, s.lostItems)) throw new Error("Chat is closed for this trip")
    if (!text) throw new Error("Write a message")
    if (hasPhoneNumber(text)) throw new Error("Phone numbers cannot be sent in chat")
    const message = { id: `msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`, tripId, channel, sender: role, senderId: from.senderId, body: text.slice(0, 500), quickReply: !!quickReply, createdAt: nowIso() }
    s.chat.push(message)
    if (role !== "driver") notify(driverKey(trip.driverId), "chat_message", "New message", text.slice(0, 120), `chat:${message.id}`, trip.id)
    else if (channel === "rider_driver") notify(riderKey(trip), "chat_message", "New message from your driver", text.slice(0, 120), `chat:${message.id}`, trip.id)
    else for (const item of s.admins.filter((a) => a.role === "company_admin" && a.companyId === trip.companyId)) notify(`admin:${item.id}`, "chat_message", "New message from the driver", text.slice(0, 120), `chat:${message.id}`, trip.id)
    commit(["chat", "notifications"])
    return clone(message)
  },

  async getFavouriteDrivers(riderId) {
    return clone(store().favourites.filter((item) => !riderId || item.riderId === riderId))
  },
  async setFavouriteDriver(riderId, driverId, favourite) {
    await delay()
    const s = store()
    if (favourite) {
      if (!s.trips.some((trip) => trip.riderId === riderId && trip.driverId === driverId && trip.status === "completed")) throw new Error("You can favourite a driver after a trip with them")
      if (!s.favourites.some((item) => item.riderId === riderId && item.driverId === driverId)) s.favourites.push({ riderId, driverId, createdAt: nowIso() })
    } else {
      s.favourites = s.favourites.filter((item) => !(item.riderId === riderId && item.driverId === driverId))
    }
    commit(["extras"])
  },

  async getDriverPreferences() {
    return clone(store().preferences)
  },
  async setDriverPreferences(driverId, preferences) {
    await delay()
    const s = store()
    findDriver(driverId)
    if (!preferences.rideTypes.length) throw new Error("Pick at least one ride type")
    if (preferences.headingHomeZone) {
      const until = preferences.headingHomeUntil ? Date.parse(preferences.headingHomeUntil) : NaN
      if (!(until > Date.now()) || until > Date.now() + HEADING_HOME_MAX_HOURS * 3_600_000) throw new Error("Heading home lasts up to 12 hours")
    }
    const row = { driverId, rideTypes: [...preferences.rideTypes], headingHomeZone: preferences.headingHomeZone || undefined, headingHomeUntil: preferences.headingHomeZone ? preferences.headingHomeUntil : undefined }
    s.preferences = [...s.preferences.filter((item) => item.driverId !== driverId), row]
    commit(["extras", "drivers"])
    return clone(row)
  },

  async getBusyAreas() {
    await delay(60)
    return busyAreas(store().trips)
  },

  async getFreeCars() {
    await delay(60)
    const s = store()
    const activeFirms = new Set(s.firms.filter((firm) => firm.status === "active").map((firm) => firm.id))
    return s.drivers
      .filter((driver) => driver.approval === "approved" && driver.status === "online" && activeFirms.has(driver.firmId) && s.cars.some((car) => car.id === driver.carId && car.availability === "available"))
      .map((driver) => ({ key: `car-${hashOf(driver.id).toString(36)}`, zone: driver.zone }))
  },

  async createTripShare(tripId) {
    await delay()
    const trip = findTrip(tripId)
    if (endedStatuses.includes(trip.status)) throw new Error("This trip has ended")
    const bytes = new Uint8Array(24)
    crypto.getRandomValues(bytes)
    const token = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("")
    store().shares.push({ token, tripId })
    commit(["extras"])
    return token
  },
  async revokeTripShares(tripId) {
    for (const share of store().shares) if (share.tripId === tripId && !share.revokedAt) share.revokedAt = nowIso()
    commit(["extras"])
  },
  async getSharedTrip(token) {
    await delay(60)
    const s = store()
    const share = s.shares.find((item) => item.token === token && !item.revokedAt)
    const trip = share && s.trips.find((item) => item.id === share.tripId)
    if (!trip || endedStatuses.includes(trip.status)) return undefined
    const driver = s.drivers.find((item) => item.id === trip.driverId)
    const car = s.cars.find((item) => item.id === trip.carId)
    const eta = driver && trip.status === "driver_arriving" ? pickupMinutes(kmBetween(driver.zone, trip.pickup)) : undefined
    return clone({
      status: trip.status,
      type: trip.type,
      pickup: trip.pickup,
      dropoff: trip.dropoff,
      acceptedAt: trip.acceptedAt,
      arrivedAt: trip.arrivedAt,
      startedAt: trip.startedAt,
      pickupEtaMinutes: eta,
      driverFirstName: driver?.name.split(/\s+/)[0],
      car: car ? { plate: car.plate, make: car.make, model: car.model, colour: car.colour } : undefined,
    })
  },

  async getLostItems() {
    await delay(60)
    return clone(store().lostItems)
  },
  async reportLostItem(tripId, description) {
    await delay()
    const s = store()
    const trip = findTrip(tripId)
    if (trip.status !== "completed" || !trip.driverId) throw new Error("Report a lost item after a completed trip")
    if (trip.completedAt && Date.parse(trip.completedAt) < Date.now() - LOST_ITEM_DAYS * 86_400_000) throw new Error("Lost items can be reported up to 30 days after the trip")
    const text = description.trim()
    if (!text) throw new Error("Describe the item")
    const incident = { id: `INC-${Date.now().toString().slice(-5)}`, tripId, type: "lost_item" as const, description: `Lost item: ${text.slice(0, 480)}`, status: "open" as const, notes: [], reportedBy: "rider", createdAt: nowIso() }
    s.incidents.unshift(incident)
    for (const key of adminKeysFor(trip)) notify(key, "incident_opened", "Incident opened", incident.description.slice(0, 120), `incident:${incident.id}`, tripId)
    const item = { id: `LOST-${Date.now().toString(36).slice(-6)}`, tripId, riderId: trip.riderId, incidentId: incident.id, description: text.slice(0, 500), status: "open" as const, chatOpenUntil: new Date(Date.now() + LOST_ITEM_CHAT_HOURS * 3_600_000).toISOString(), createdAt: nowIso() }
    s.lostItems.unshift(item)
    commit(["extras", "incidents", "chat", "notifications"])
    return clone(item)
  },
  async updateLostItem(itemId, status) {
    await delay()
    const item = store().lostItems.find((row) => row.id === itemId)
    if (!item) throw new Error("Not found")
    item.status = status
    commit(["extras"])
    return clone(item)
  },

  async getSettings() {
    return clone({ ...defaultSettings, ...store().settings })
  },
  async setSetting(key, value) {
    await delay()
    const s = store()
    s.settings = { ...defaultSettings, ...s.settings, [key]: value }
    commit(["extras"])
    return clone(s.settings)
  },
  async getBonusTargets() {
    return clone(store().bonusTargets)
  },
  async saveBonusTarget(input) {
    await delay()
    const s = store()
    const name = input.name.trim()
    if (!name) throw new Error("Give the target a name")
    if (!Number.isInteger(input.target) || input.target < 1) throw new Error("The target is a whole number of trips, 1 or more")
    const existing = input.id ? s.bonusTargets.find((item) => item.id === input.id) : undefined
    const row = { id: existing?.id ?? `bonus-${Date.now().toString(36)}`, name, metric: "completed_trips" as const, period: input.period, target: input.target, firmId: input.firmId || undefined, active: input.active, createdAt: existing?.createdAt ?? nowIso() }
    s.bonusTargets = existing ? s.bonusTargets.map((item) => (item.id === row.id ? row : item)) : [...s.bonusTargets, row]
    commit(["extras"])
    return clone(row)
  },
  async getBonusProgress(driverId) {
    const s = store()
    const driver = findDriver(driverId)
    return bonusProgress(driver, s.bonusTargets, s.trips, { ...defaultSettings, ...s.settings })
  },

  async getRewardPoints(riderId) {
    const s = store()
    return rewardPoints(riderId, s.trips, { ...defaultSettings, ...s.settings })
  },

  async getTipDetails(tripId) {
    await delay(60)
    const s = store()
    const trip = s.trips.find((item) => item.id === tripId)
    if (!trip) return undefined
    const driver = s.drivers.find((item) => item.id === trip.driverId)
    const firm = s.firms.find((item) => item.id === driver?.firmId)
    if (!tipOpen(trip, driver, firm)) return undefined
    return { driverFirstName: driver!.name.split(/\s+/)[0], momoNumber: driver!.tipMomoNumber!, until: new Date(Date.parse(trip.completedAt!) + 24 * 3_600_000).toISOString(), alreadyTipped: s.tips.some((tip) => tip.tripId === trip.id) }
  },
  async recordTip(tripId, amount) {
    await delay()
    const s = store()
    if (!(await this.getTipDetails(tripId))) throw new Error("Tips are not available for this trip")
    checkTipAmount(amount)
    if (s.tips.some((tip) => tip.tripId === tripId)) throw new Error("You already tipped on this trip")
    const trip = findTrip(tripId)
    // The rider says they sent it by MoMo; Flyt does not see or move the money.
    const tip = { id: `tip-${Date.now()}`, tripId, riderId: trip.riderId, driverId: trip.driverId!, amount, riderSentAt: nowIso() }
    s.tips.push(tip)
    commit(["extras"])
    return clone(tip)
  },
  async getTips() {
    return clone(store().tips)
  },
  async setFirmTips(firmId, enabled) {
    await delay()
    const firm = findFirm(firmId)
    firm.tipsEnabled = enabled
    commit(["firms"])
    return clone(firm)
  },
  async setTipSettings(driverId, { optIn, momoNumber }) {
    await delay()
    const driver = findDriver(driverId)
    const phone = momoNumber?.trim() ? normalizePhone(momoNumber) : undefined
    if (momoNumber?.trim() && !phone) throw new Error("Enter a valid Rwandan mobile number")
    if (optIn && !(phone ?? driver.tipMomoNumber)) throw new Error("Add the MoMo number tips should go to")
    driver.tipsOptIn = optIn
    if (phone) driver.tipMomoNumber = phone
    commit(["drivers"])
    return clone(driver)
  },

  async resetDemo() {
    await delay()
    db = buildSeed()
    commit(["firms", "companies", "riders", "drivers", "cars", "trips", "offers", "routes", "invoices", "incidents", "pricing", "admins", "notifications", "chat", "extras"])
  },
}

/** Test helper: start from a fresh seed. */
export function __resetMockStore(seed?: MockDb) {
  db = seed ?? buildSeed()
}

