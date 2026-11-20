import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js"
import { devSignIn as devSignInEnabled, isLocalSupabase, supabaseAnonKey, supabaseUrl } from "../config"
import type { Database } from "../database.types"
import { normalizePhone } from "../format"
import { defaultSettings } from "../additions"
import type {
  AdminUser,
  AppNotification,
  AppSettings,
  BonusProgress,
  BonusTarget,
  BusyArea,
  FreeCar,
  Car,
  ChatMessage,
  CommuteRoute,
  Company,
  CompanyInvoice,
  ComplianceDocument,
  Driver,
  DriverPreferences,
  FavouriteDriver,
  FeeInvoice,
  Firm,
  Incident,
  JobOffer,
  LostItem,
  NotificationType,
  PricingConfig,
  RewardPoints,
  Rider,
  SharedTripView,
  Tip,
  TipDetails,
  Trip,
} from "../types"
import type { DataSource, Topic } from "./types"

// Supabase data source. Every write is an RPC function in Postgres (supabase/migrations), which checks who is
// calling, works out fares, fees and invoice totals, and allows only the agreed status moves. RLS limits every read.
// Only the public anon key is used here; the service-role key never goes in client code.
// Auto-assign does not exist in this adapter: dispatch is always by hand in Supabase mode.

type Row = Record<string, unknown>
let client: SupabaseClient<Database> | undefined

function db(): SupabaseClient<Database> {
  if (!supabaseAnonKey) throw new Error("Set NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local (printed by supabase start).")
  client ??= createClient<Database>(supabaseUrl, supabaseAnonKey, { auth: { persistSession: true, storageKey: "flyt-auth" } })
  return client
}

// ── Mapping: snake_case rows to the app's camelCase types; null becomes undefined ────────────
const camelKey = (key: string) => key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())
function camel<T>(row: Row | null | undefined): T {
  const out: Row = {}
  for (const [key, value] of Object.entries(row ?? {})) if (value !== null) out[camelKey(key)] = value
  return out as T
}
const camelAll = <T,>(rows: Row[] | null | undefined) => (rows ?? []).map((row) => camel<T>(row))

function fail(error: { message: string; code?: string } | null): never | void {
  if (!error) return
  // Postgres raises plain-language messages (see the RPC functions); show them as they are.
  throw new Error(error.message)
}

async function rpc<T>(name: string, args: Row = {}): Promise<T> {
  // The generated types know every function; a loose call keeps this one helper simple.
  const { data, error } = await (db().rpc as unknown as (fn: string, args: Row) => Promise<{ data: unknown; error: { message: string } | null }>)(name, args)
  fail(error)
  return data as T
}

async function select<T>(table: keyof Database["public"]["Tables"], match?: Record<string, string>): Promise<T[]> {
  let query = db().from(table).select("*")
  for (const [column, value] of Object.entries(match ?? {})) query = query.eq(column as never, value as never)
  const { data, error } = await query
  fail(error)
  return camelAll<T>(data as Row[] | null)
}

// ── Change notices: local listeners, plus Supabase Realtime for trips, offers and drivers ────
const listeners = new Set<{ topics: Topic[]; callback: () => void }>()
let channel: RealtimeChannel | undefined
const realtimeTopics: Record<string, Topic> = { trips: "trips", job_offers: "offers", drivers: "drivers", notifications: "notifications", chat_messages: "chat" }

function notify(topics: Topic[]) {
  for (const listener of listeners) if (listener.topics.some((topic) => topics.includes(topic))) listener.callback()
}

const allTopics: Topic[] = ["firms", "companies", "riders", "drivers", "cars", "trips", "offers", "routes", "invoices", "incidents", "pricing", "admins", "notifications", "chat", "extras"]

function ensureRealtime() {
  if (channel || typeof window === "undefined" || !supabaseAnonKey) return
  // Signing in or out changes what RLS lets this person read: reload everything on screen.
  db().auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN" || event === "SIGNED_OUT") setTimeout(() => notify(allTopics), 0)
  })
  channel = db().channel("flyt-live")
  for (const [table, topic] of Object.entries(realtimeTopics)) {
    // RLS applies: each person only receives rows they may read.
    channel.on("postgres_changes", { event: "*", schema: "public", table }, () => notify([topic, ...(topic === "trips" ? (["offers"] as Topic[]) : [])]))
  }
  channel.subscribe()
}

/** Run a write and tell this tab's screens which data changed. */
async function write<T>(topics: Topic[], action: () => Promise<T>): Promise<T> {
  const result = await action()
  notify(topics)
  return result
}

// ── Loading full app objects ──────────────────────────────────────────────────────────────
type DocRow = ComplianceDocument & { driverId?: string; carId?: string; filePath?: string }
const toDoc = ({ id, type, expiryDate, review, rejectReason, filePath }: DocRow): ComplianceDocument => ({ id, type, expiryDate, review, rejectReason, hasFile: !!filePath })

async function loadDocuments() {
  return select<DocRow>("documents")
}

async function loadDrivers(): Promise<Driver[]> {
  const [rows, docs] = await Promise.all([select<Driver>("drivers"), loadDocuments()])
  return rows.map((driver) => ({ ...driver, suspendAfterTrip: driver.suspendAfterTrip || undefined, documents: docs.filter((doc) => doc.driverId === driver.id).map(toDoc) }))
}

async function loadCars(): Promise<Car[]> {
  const [rows, docs] = await Promise.all([select<Car>("cars"), loadDocuments()])
  return rows.map((car) => ({ ...car, documents: docs.filter((doc) => doc.carId === car.id).map(toDoc) }))
}

const byNewest = (trips: Trip[]) => trips.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
const expire = () => rpc<number>("expire_offers").catch(() => 0)

async function sessionPhone(phone: string, code?: string) {
  const { data: existing } = await db().auth.getSession()
  // Dev sign-in (local only) already made a session; no phone is typed.
  if (!phone && existing.session) return
  const normalized = normalizePhone(phone)
  if (!normalized) throw new Error("Enter a valid Rwandan mobile number")
  const e164 = `+${normalized.replace(/\D/g, "")}`
  const { data } = await db().auth.getSession()
  const current = data.session?.user.phone
  // Already signed in with this phone: no new code needed.
  if (current && current.replace(/\D/g, "") === e164.slice(1)) return
  if (!code || !/^\d{6}$/.test(code)) throw new Error("Enter the 6-digit code from the SMS")
  const { error } = await db().auth.verifyOtp({ phone: e164, token: code, type: "sms" })
  if (error) throw new Error(error.message === "Token has expired or is invalid" ? "That code is wrong or has expired" : error.message)
}

const one = <T,>(row: unknown) => camel<T>(row as Row)

// app_settings keys in Postgres for each AppSettings field.
const settingKeys: Record<keyof AppSettings, string> = {
  bonusesEnabled: "bonuses_enabled",
  pointsPer1000Rwf: "points_per_1000_rwf",
  pointsRedemptionEnabled: "points_redemption_enabled",
  requestWaitingMinutes: "request_waiting_minutes",
  scheduledReminderMinutes: "scheduled_reminder_minutes",
}

async function loadSettings(): Promise<AppSettings> {
  const { data, error } = await db().from("app_settings").select("key, value")
  fail(error)
  const settings: AppSettings = { ...defaultSettings }
  for (const [field, key] of Object.entries(settingKeys) as [keyof AppSettings, string][]) {
    const row = (data ?? []).find((item) => item.key === key)
    if (row) (settings as unknown as Record<string, unknown>)[field] = row.value
  }
  return settings
}

export const supabaseSource: DataSource = {
  subscribe(topics, callback) {
    ensureRealtime()
    const listener = { topics, callback }
    listeners.add(listener)
    return () => listeners.delete(listener)
  },

  // ── Reads (RLS decides what each person gets) ──
  async getFirms() {
    // Signed out (map first, before booking): only what the fare preview needs, from public.quote_firms.
    const { data } = await db().auth.getSession()
    if (!data.session) return camelAll<Firm>(await rpc<Row[]>("quote_firms"))
    return select<Firm>("firms")
  },
  getCompanies: () => select<Company>("companies"),
  getRiders: () => select<Rider>("riders"),
  async getRider(id) {
    return (await select<Rider>("riders", { id: id }))[0]
  },
  getDrivers: async () => {
    await expire()
    return loadDrivers()
  },
  getCars: loadCars,
  async getTrips() {
    await expire()
    return byNewest(await select<Trip>("trips"))
  },
  async getTrip(id) {
    await expire()
    return (await select<Trip>("trips", { id: id }))[0]
  },
  async getRiderTrips(riderId) {
    await expire()
    return byNewest(await select<Trip>("trips", { rider_id: riderId }))
  },
  async getTripAssignment(tripId) {
    const trip = await this.getTrip(tripId)
    if (!trip) return undefined
    const [drivers, cars, firms, riders] = await Promise.all([trip.driverId ? loadDrivers() : Promise.resolve([]), trip.carId ? loadCars() : Promise.resolve([]), select<Firm>("firms"), select<Rider>("riders")])
    return { trip, driver: drivers.find((item) => item.id === trip.driverId), car: cars.find((item) => item.id === trip.carId), firm: firms.find((item) => item.id === trip.firmId), rider: riders.find((item) => item.id === trip.riderId) }
  },
  async getOffers(driverId) {
    await expire()
    const rows = await select<JobOffer>("job_offers")
    return rows.filter((offer) => !driverId || offer.driverId === driverId)
  },
  getCommuteRoutes: () => select<CommuteRoute>("commute_routes"),
  getFeeInvoices: () => select<FeeInvoice>("fee_invoices"),
  getCompanyInvoices: () => select<CompanyInvoice>("company_invoices"),
  getIncidents: () => select<Incident>("incidents"),
  async getPricing(): Promise<PricingConfig> {
    const [plans, zones] = await Promise.all([select<PricingConfig["plans"][number]>("pricing_plans"), select<PricingConfig["airportZones"][number]>("airport_zones")])
    return { plans: plans.sort((a, b) => a.name.localeCompare(b.name)), airportZones: zones }
  },
  getAdmins: () => select<AdminUser>("admins"),

  // ── Sign-in ──
  async requestSignInCode(phone) {
    const normalized = normalizePhone(phone)
    if (!normalized) throw new Error("Enter a valid Rwandan mobile number")
    const { error } = await db().auth.signInWithOtp({ phone: `+${normalized.replace(/\D/g, "")}` })
    if (!error) return { sent: true }
    // No SMS provider is set up yet (it needs Flyt Ltd's approval). Local Supabase has test codes for seeded phones.
    if ((error as { code?: string }).code === "phone_provider_disabled" || /phone provider/i.test(error.message)) {
      if (isLocalSupabase) return { sent: false, note: "No SMS is sent on local Supabase. Seeded phones use the test code from supabase/config.toml." }
      throw new Error("SMS sign-in is not set up yet")
    }
    throw new Error(error.message)
  },
  async signInAdmin({ phone, code, portal }) {
    await sessionPhone(phone, code)
    return camelAll<AdminUser>(await rpc<Row[]>("claim_admin", { p_portal: portal }))
  },
  async getSignedInAdmins(portal) {
    const { data } = await db().auth.getSession()
    if (!data.session) return []
    const roles = portal === "ops" ? ["platform_admin", "firm_admin"] : ["company_admin"]
    const mine = await select<AdminUser & { authUserId?: string }>("admins", { auth_user_id: data.session!.user.id })
    return mine.filter((admin) => roles.includes(admin.role)).map((admin) => ({ id: admin.id, name: admin.name, phone: admin.phone, role: admin.role, firmId: admin.firmId, companyId: admin.companyId }))
  },
  async devSignIn(email, password) {
    if (!devSignInEnabled) throw new Error("Dev sign-in is off")
    const { error } = await db().auth.signInWithPassword({ email, password })
    fail(error)
  },
  async signOut() {
    await db().auth.signOut()
    notify(["riders", "drivers", "admins"])
  },

  // ── Riders ──
  async signInRider({ phone, code, name, consent, joinCode }) {
    await sessionPhone(phone, code)
    return write(["riders"], async () => one<Rider>(await rpc("register_rider", { p_name: name ?? null, p_consent: consent, p_join_code: joinCode ?? null })))
  },
  updateRider: (_riderId, update) =>
    write(["riders"], async () => one<Rider>(await rpc("update_rider_profile", { p_name: update.name ?? null, p_language: update.language ?? null, p_saved_places: update.savedPlaces ?? null, p_emergency_contacts: update.emergencyContacts ?? null }))),

  // ── Booking and trip status ──
  quoteTrip: (input) => rpc("quote_trip", { p_type: input.type, p_pickup: input.pickup, p_dropoff: input.dropoff, p_hire_quantity: input.hireQuantity ?? null }),
  getPickupEtas: (pickup, types) => rpc("pickup_etas", { p_pickup: pickup, p_types: types }),
  createBooking: (input) =>
    write(["trips"], async () => one<Trip>(await rpc("create_booking", { p_pickup: input.pickup, p_dropoff: input.dropoff, p_type: input.type, p_payment_method: input.paymentMethod, p_hire_quantity: input.hireQuantity ?? null, p_scheduled_for: input.scheduledFor ?? null }))),
  // Who may dispatch is checked in Postgres (app.require_dispatch) from the signed-in person.
  assignDriver: (tripId, driverId) => write(["trips", "drivers", "cars", "offers"], async () => one<Trip>(await rpc("assign_driver", { p_trip: tripId, p_driver: driverId }))),
  reassignDriver: (tripId, driverId) => write(["trips", "drivers", "cars", "offers"], async () => one<Trip>(await rpc("reassign_driver", { p_trip: tripId, p_driver: driverId }))),
  respondOffer: (offerId, accept) => write(["trips", "offers", "drivers", "cars"], async () => one<Trip>(await rpc("respond_offer", { p_offer: offerId, p_accept: accept }))),
  driverArrived: (tripId) => write(["trips"], async () => one<Trip>(await rpc("driver_arrived", { p_trip: tripId }))),
  startTrip: (tripId, pin) =>
    write(["trips"], async () => {
      if (!pin || !/^\d{4}$/.test(pin)) throw new Error("Enter the rider's 4-digit trip PIN")
      const row = await rpc<Row | null>("start_trip", { p_trip: tripId, p_pin: pin })
      // A wrong PIN is counted in Postgres and returns no trip.
      if (!row || !row.id) throw new Error("That PIN is not right. Ask the rider for the PIN in their app")
      return one<Trip>(row)
    }),
  endTrip: (tripId) => write(["trips", "drivers", "cars"], async () => one<Trip>(await rpc("end_trip", { p_trip: tripId }))),
  // Who cancels (rider, driver or Ops) is worked out in Postgres from the signed-in person.
  cancelTrip: (tripId, _by, reason) => write(["trips", "drivers", "cars", "offers"], async () => one<Trip>(await rpc("cancel_trip", { p_trip: tripId, p_reason: reason }))),
  markNoDriverFound: (tripId) => write(["trips"], async () => one<Trip>(await rpc("mark_no_driver_found", { p_trip: tripId }))),

  // ── Payment and ratings ──
  riderMarkPaid: (tripId) => write(["trips"], async () => one<Trip>(await rpc("rider_mark_paid", { p_trip: tripId }))),
  confirmPayment: (tripId, received) => write(["trips"], async () => one<Trip>(await rpc("confirm_payment", { p_trip: tripId, p_received: received }))),
  rateTrip: (tripId, rating, tags, comment) => write(["trips"], async () => one<Trip>(await rpc("rate_trip", { p_trip: tripId, p_rating: rating, p_tags: tags ?? null, p_comment: comment ?? null }))),
  rateRider: (tripId, rating) => write(["trips"], async () => one<Trip>(await rpc("rate_rider", { p_trip: tripId, p_rating: rating }))),

  // ── Fleet ──
  addFirm: (input) => write(["firms"], async () => one<Firm>(await rpc("add_firm", { p: input }))),
  addDriver: async (input) => {
    const row = await write(["drivers"], async () => one<Driver>(await rpc("add_driver", { p: input })))
    return (await loadDrivers()).find((driver) => driver.id === row.id) ?? { ...row, documents: [] }
  },
  addCar: async (input) => {
    const row = await write(["cars"], async () => one<Car>(await rpc("add_car", { p: input })))
    return (await loadCars()).find((car) => car.id === row.id) ?? { ...row, documents: [] }
  },
  setDriverApproval: async (driverId, approval) => {
    await write(["drivers"], () => rpc("set_driver_approval", { p_driver: driverId, p_approval: approval }))
    return (await loadDrivers()).find((driver) => driver.id === driverId)!
  },
  reviewDocument: ({ owner, ownerId, type, decision, reason }) =>
    write([owner === "driver" ? "drivers" : "cars"], async () => toDoc(one<DocRow>(await rpc("review_document", { p_owner: owner, p_owner_id: ownerId, p_type: type, p_decision: decision, p_reason: reason ?? null })))),

  // ── Companies and staff ──
  addCompany: (input) => write(["companies"], async () => one<Company>(await rpc("add_company", { p: input }))),
  addStaff: (companyId, input) => write(["riders"], async () => one<Rider>(await rpc("add_staff", { p_company: companyId, p_name: input.name, p_phone: input.phone }))),
  removeStaff: (companyId, riderId) => write(["riders", "routes"], async () => one<Rider>(await rpc("remove_staff", { p_company: companyId, p_rider: riderId }))),

  // ── Invoices (totals in Postgres) ──
  generateInvoices: (period) => write(["invoices"], () => rpc("generate_invoices", { p_period: period })),
  setInvoiceStatus: (kind, invoiceId, status) => write(["invoices"], async () => one<FeeInvoice | CompanyInvoice>(await rpc("set_invoice_status", { p_kind: kind, p_invoice: invoiceId, p_status: status }))),
  correctTripFare: ({ tripId, fare, reason }) => write(["trips"], async () => one<Trip>(await rpc("correct_trip_fare", { p_trip: tripId, p_fare: fare, p_reason: reason }))),

  // ── Team ──
  addAdmin: (input) => write(["admins"], async () => one<AdminUser>(await rpc("add_admin", { p_name: input.name, p_phone: input.phone, p_role: input.role, p_firm: input.firmId ?? null, p_company: input.companyId ?? null }))),
  removeAdmin: (adminId) => write(["admins"], async () => void (await rpc("remove_admin", { p_admin: adminId }))),

  // ── Drivers ──
  async signInDriver({ phone, code }) {
    await sessionPhone(phone, code)
    const row = one<Driver>(await rpc("claim_driver"))
    return (await loadDrivers()).find((driver) => driver.id === row.id) ?? { ...row, documents: [] }
  },
  async getDriverTrips(driverId) {
    await expire()
    return byNewest(await select<Trip>("trips", { driver_id: driverId }))
  },
  async getDriverJob(tripId) {
    const trip = await this.getTrip(tripId)
    if (!trip) return undefined
    const rider = await rpc<{ firstName: string; phone?: string | null; rating?: number | null; tripCount: number; verified?: boolean } | null>("driver_job", { p_trip: tripId })
    if (!rider) return undefined
    const [cars, firms] = await Promise.all([select<Car>("cars"), select<Firm>("firms")])
    const car = cars.find((item) => item.id === trip.carId)
    return { trip, rider: { firstName: rider.firstName, phone: rider.phone ?? undefined, rating: rider.rating ?? undefined, tripCount: rider.tripCount, verified: !!rider.verified }, car: car && { ...car, documents: [] }, firm: firms.find((item) => item.id === trip.firmId) }
  },
  async submitDocument(driverId, type, expiryDate, file) {
    let path: string | null = null
    if (file) {
      // Private bucket, the driver's own folder. Only the driver, their firm admin and platform admins can open it.
      const extension = file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg"
      path = `${driverId}/${type}/${Date.now()}.${extension}`
      const { error } = await db().storage.from("documents").upload(path, file, { contentType: file.type, upsert: false })
      fail(error)
    }
    await write(["drivers"], () => rpc("submit_document", { p_type: type, p_expiry: type === "national_id" ? null : expiryDate, p_file_path: path }))
    return (await loadDrivers()).find((driver) => driver.id === driverId)!
  },
  async getDocumentFileUrl(owner, ownerId, type) {
    const docs = await loadDocuments()
    const doc = docs.find((item) => item.type === type && (owner === "driver" ? item.driverId === ownerId : item.carId === ownerId))
    if (!doc?.filePath) return undefined
    // A short-lived link: it stops working after 60 seconds.
    const { data, error } = await db().storage.from("documents").createSignedUrl(doc.filePath, 60)
    fail(error)
    return data?.signedUrl
  },
  async setDriverPresence(driverId, presence) {
    await write(["drivers"], () => rpc("set_driver_presence", { p_presence: presence }))
    return (await loadDrivers()).find((driver) => driver.id === driverId)!
  },

  // ── Pricing ──
  async setActivePlan(name) {
    await write(["pricing"], () => rpc("set_active_plan", { p_name: name }))
    return this.getPricing()
  },
  async updatePlan(name, values) {
    await write(["pricing"], () => rpc("update_plan", { p_name: name, p_first_km: values.firstKm ?? null, p_per_km: values.perKm ?? null, p_shared_seat_percent: values.sharedSeatPercent ?? null }))
    return this.getPricing()
  },
  async updateAirportZones(zones) {
    await write(["pricing"], () => rpc("update_airport_zones", { p_zones: zones }))
    return this.getPricing()
  },
  setFirmFee: (firmId, feePercent) => write(["firms"], async () => one<Firm>(await rpc("set_firm_fee", { p_firm: firmId, p_fee_percent: feePercent }))),
  setFirmRates: (firmId, rates) => write(["firms"], async () => one<Firm>(await rpc("set_firm_rates", { p_firm: firmId, p_hourly_rate: rates.hourlyRate ?? null, p_daily_rate: rates.dailyRate ?? null }))),

  // ── Incidents ──
  reportIncident: (input) => write(["incidents"], async () => one<Incident>(await rpc("report_incident", { p_type: input.type, p_description: input.description, p_trip: input.tripId ?? null }))),
  updateIncident: (incidentId, update) => write(["incidents"], async () => one<Incident>(await rpc("update_incident", { p_incident: incidentId, p_status: update.status ?? null, p_note: update.note ?? null }))),

  // ── Phase 6B additions (RLS limits reads; RPC functions check every write) ──
  async getNotifications() {
    const { data: session } = await db().auth.getSession()
    if (!session.session) return []
    const { data, error } = await db().from("notifications").select("*").order("created_at", { ascending: false }).limit(100)
    fail(error)
    return camelAll<AppNotification>(data as Row[]).map((item): AppNotification => ({ id: item.id, type: item.type, title: item.title, body: item.body, link: item.link, tripId: item.tripId, createdAt: item.createdAt, readAt: item.readAt }))
  },
  markNotificationsRead: (_viewer, ids) => write(["notifications"], async () => void (await rpc("mark_notifications_read", { p_ids: ids ?? null }))),
  async getNotificationMutes() {
    const { data: session } = await db().auth.getSession()
    if (!session.session) return []
    return (await select<{ type: NotificationType }>("notification_mutes")).map((row) => row.type)
  },
  setNotificationMute: (_viewer, type, muted) => write(["notifications"], async () => void (await rpc("set_notification_mute", { p_type: type, p_muted: muted }))),
  savePushSubscription: (_viewer, subscription) => write(["notifications"], async () => void (await rpc("save_push_subscription", { p_endpoint: subscription.endpoint, p_p256dh: subscription.p256dh, p_auth: subscription.auth }))),
  deletePushSubscription: (endpoint) => write(["notifications"], async () => void (await rpc("delete_push_subscription", { p_endpoint: endpoint }))),

  async getTripPin(tripId) {
    // Only the rider of the trip (and platform admins) can read it.
    return (await select<{ pin: string }>("trip_pins", { trip_id: tripId }))[0]?.pin
  },

  async getChat(tripId, channel) {
    const rows = await select<ChatMessage>("chat_messages", { trip_id: tripId, channel })
    return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  },
  sendChat: ({ tripId, channel, body, quickReply }) => write(["chat"], async () => one<ChatMessage>(await rpc("send_chat", { p_trip: tripId, p_channel: channel, p_body: body, p_quick_reply: !!quickReply }))),

  async getFavouriteDrivers(riderId) {
    const rows = await select<FavouriteDriver>("favourite_drivers")
    return rows.filter((row) => !riderId || row.riderId === riderId)
  },
  setFavouriteDriver: (_riderId, driverId, favourite) => write(["extras"], async () => void (await rpc("set_favourite_driver", { p_driver: driverId, p_favourite: favourite }))),

  getDriverPreferences: () => select<DriverPreferences>("driver_preferences"),
  setDriverPreferences: (_driverId, preferences) =>
    write(["extras", "drivers"], async () => one<DriverPreferences>(await rpc("set_driver_preferences", { p_ride_types: preferences.rideTypes, p_heading_home_zone: preferences.headingHomeZone ?? null, p_heading_home_until: preferences.headingHomeZone ? (preferences.headingHomeUntil ?? null) : null }))),

  getBusyAreas: async () => camelAll<BusyArea>(await rpc<Row[]>("busy_areas")),
  getFreeCars: async () => camelAll<FreeCar>(await rpc<Row[]>("free_cars")),

  createTripShare: (tripId) => write(["extras"], () => rpc<string>("create_trip_share", { p_trip: tripId })),
  revokeTripShares: (tripId) => write(["extras"], async () => void (await rpc("revoke_trip_shares", { p_trip: tripId }))),
  async getSharedTrip(token) {
    // Works without signing in (anon); the token is checked against its hash in Postgres.
    const view = await rpc<SharedTripView | null>("shared_trip", { p_token: token })
    return view ? (JSON.parse(JSON.stringify(view, (_key, value) => (value === null ? undefined : value))) as SharedTripView) : undefined
  },

  getLostItems: () => select<LostItem>("lost_items"),
  reportLostItem: (tripId, description) => write(["extras", "incidents", "chat"], async () => one<LostItem>(await rpc("report_lost_item", { p_trip: tripId, p_description: description }))),
  updateLostItem: (itemId, status) => write(["extras"], async () => one<LostItem>(await rpc("update_lost_item", { p_item: itemId, p_status: status }))),

  getSettings: loadSettings,
  async setSetting(key, value) {
    await write(["extras"], () => rpc("set_setting", { p_key: settingKeys[key], p_value: value }))
    return loadSettings()
  },
  getBonusTargets: () => select<BonusTarget>("bonus_targets"),
  saveBonusTarget: (input) =>
    write(["extras"], async () => one<BonusTarget>(await rpc("save_bonus_target", { p_id: input.id ?? null, p_name: input.name, p_period: input.period, p_target: input.target, p_firm: input.firmId ?? null, p_active: input.active }))),
  getBonusProgress: async (driverId) => camelAll<BonusProgress>(await rpc<Row[]>("bonus_progress", { p_driver: driverId })),

  async getRewardPoints(riderId): Promise<RewardPoints> {
    const rows = await select<{ tripId?: string; points: number; reason: string; createdAt: string }>("reward_points", { rider_id: riderId })
    const entries = rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(({ tripId, points, reason, createdAt }) => ({ tripId, points, reason, createdAt }))
    return { total: entries.reduce((sum, entry) => sum + entry.points, 0), entries }
  },

  async getTipDetails(tripId) {
    return (await rpc<TipDetails | null>("tip_details", { p_trip: tripId })) ?? undefined
  },
  recordTip: (tripId, amount) => write(["extras"], async () => one<Tip>(await rpc("record_tip", { p_trip: tripId, p_amount: amount }))),
  getTips: () => select<Tip>("tips"),
  setFirmTips: (firmId, enabled) => write(["firms"], async () => one<Firm>(await rpc("set_firm_tips", { p_firm: firmId, p_enabled: enabled }))),
  async setTipSettings(driverId, { optIn, momoNumber }) {
    await write(["drivers"], () => rpc("set_tip_settings", { p_opt_in: optIn, p_number: momoNumber ?? null }))
    return (await loadDrivers()).find((driver) => driver.id === driverId)!
  },
}
