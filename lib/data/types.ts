import type { RiderForDriver } from "../driver"
import type { FareQuote } from "../pricing"
import type {
  AdminUser,
  AirportZone,
  Car,
  CancelledBy,
  CommuteRoute,
  ComplianceDocument,
  DocumentType,
  DriverApproval,
  Company,
  CompanyInvoice,
  Driver,
  DriverPresence,
  EmergencyContact,
  FeeInvoice,
  Firm,
  Incident,
  IncidentStatus,
  InvoiceStatus,
  JobOffer,
  Language,
  PaymentMethod,
  PlaceId,
  PlanName,
  PlatformFeePercent,
  PricingConfig,
  PricingPlan,
  Rider,
  SavedPlace,
  Trip,
  TripType,
  AppNotification,
  AppSettings,
  BonusProgress,
  BonusTarget,
  BusyArea,
  FreeCar,
  ChatChannel,
  ChatMessage,
  ChatSender,
  DriverPreferences,
  FavouriteDriver,
  LostItem,
  LostItemStatus,
  NotificationType,
  PushSubscriptionInput,
  RewardPoints,
  SharedTripView,
  Tip,
  TipDetails,
  Viewer,
} from "../types"

/** Change topics. A subscriber is called when data in one of its topics changes, in this tab or another. */
export type Topic =
  | "firms"
  | "companies"
  | "riders"
  | "drivers"
  | "cars"
  | "trips"
  | "offers"
  | "routes"
  | "invoices"
  | "incidents"
  | "pricing"
  | "admins"
  | "notifications"
  | "chat"
  | "extras"

export interface BookingInput {
  riderId: string
  pickup: PlaceId
  dropoff: PlaceId
  type: TripType
  paymentMethod: PaymentMethod
  hireQuantity?: number
  scheduledFor?: string
}

export interface QuoteInput { pickup: PlaceId; dropoff: PlaceId; type: TripType; hireQuantity?: number }
export interface RideQuote extends FareQuote { firmId: string }

/** A trip as the driver sees it: the rider's first name, and their phone only while the trip is active. */
export interface DriverJob { trip: Trip; rider: RiderForDriver & { verified?: boolean }; car?: Car; firm?: Firm }

export interface SendChatInput { tripId: string; channel: ChatChannel; body: string; quickReply?: boolean; /** Mock only: who is writing. Supabase works it out from the signed-in person. */ from: { sender: ChatSender; senderId: string } }
export interface BonusTargetInput { id?: string; name: string; period: BonusTarget["period"]; target: number; firmId?: string; active: boolean }
export interface TipSettingsInput { optIn: boolean; momoNumber?: string }

export interface TripAssignment { trip: Trip; driver?: Driver; car?: Car; firm?: Firm; rider?: Rider }

export type NewFirmInput = Pick<Firm, "name" | "type" | "ruraLicenceNo" | "licenceExpiry" | "tin" | "momoMerchantCode" | "airtelMerchantCode" | "feePercent" | "hourlyRate" | "dailyRate" | "status">

/** Expiry dates ("YYYY-MM-DD") by document type. A type left out is recorded as missing. */
export type DocumentExpiries = Partial<Record<DocumentType, string>>

export interface NewDriverInput { firmId: string; name: string; phone: string; zone: PlaceId; carId?: string; documents: DocumentExpiries }
export interface NewCarInput {
  firmId: string
  plate: string
  make: string
  model: string
  colour: string
  year: number
  seats: number
  power: Car["power"]
  zone: PlaceId
  documents: DocumentExpiries
}

export type NewCompanyInput = Pick<Company, "name" | "contactName" | "phone" | "staffCount" | "status"> & { joinCode?: string }
export interface NewStaffInput { name: string; phone: string }
export interface NewAdminInput { name: string; phone: string; role: AdminUser["role"]; firmId?: string; companyId?: string }

/** A platform admin's decision on a document sent for review. A rejection needs a reason, which the driver sees. */
export interface DocumentReviewInput { adminId: string; owner: "driver" | "car"; ownerId: string; type: DocumentType; decision: "approve" | "reject"; reason?: string }

export interface FareCorrectionInput { adminId: string; tripId: string; fare: number; reason: string }

export type FirmRates = Pick<Firm, "hourlyRate" | "dailyRate">

export type AdminPortal = "ops" | "company"
export interface SignInCodeResult { sent: boolean; note?: string }

export interface InvoiceRun { period: string; created: number; refreshed: number }

export interface RiderProfileUpdate {
  name?: string
  language?: Language
  savedPlaces?: SavedPlace[]
  emergencyContacts?: EmergencyContact[]
}

/**
 * The one data interface behind lib/api.ts. The mock adapter (lib/data/mock.ts) and the
 * Supabase adapter (lib/data/supabase.ts) both implement it. Money and status rules are
 * enforced inside the adapter (mock) or in Postgres RPC functions (Supabase), never by screens.
 */
export interface DataSource {
  subscribe(topics: Topic[], callback: () => void): () => void

  // Reads
  getFirms(): Promise<Firm[]>
  getCompanies(): Promise<Company[]>
  getRiders(): Promise<Rider[]>
  getRider(id: string): Promise<Rider | undefined>
  getDrivers(): Promise<Driver[]>
  getCars(): Promise<Car[]>
  getTrips(): Promise<Trip[]>
  getTrip(id: string): Promise<Trip | undefined>
  getRiderTrips(riderId: string): Promise<Trip[]>
  getTripAssignment(tripId: string): Promise<TripAssignment | undefined>
  getOffers(driverId?: string): Promise<JobOffer[]>
  getCommuteRoutes(): Promise<CommuteRoute[]>
  getFeeInvoices(): Promise<FeeInvoice[]>
  getCompanyInvoices(): Promise<CompanyInvoice[]>
  getIncidents(): Promise<Incident[]>
  getPricing(): Promise<PricingConfig>
  getAdmins(): Promise<AdminUser[]>

  // Sign-in. With Supabase: an SMS code (local Supabase uses test codes; real SMS needs a provider, not set up).
  // The mock accepts any 6-digit code.
  requestSignInCode(phone: string): Promise<SignInCodeResult>
  /** Ops (platform and firm admins) or the company portal: the signed-in person's team roles there. */
  signInAdmin(input: { phone: string; code?: string; portal: AdminPortal }): Promise<AdminUser[]>
  /** The signed-in team roles for a portal, or [] when nobody is signed in. The mock has no sessions and returns []. */
  getSignedInAdmins(portal: AdminPortal): Promise<AdminUser[]>
  /** Local development only: email and password sign-in for seeded people (NEXT_PUBLIC_DEV_SIGNIN=true and a local Supabase). */
  devSignIn?(email: string, password: string): Promise<void>
  signOut(): Promise<void>

  // Riders
  signInRider(input: { phone: string; code?: string; name?: string; consent: boolean; joinCode?: string }): Promise<Rider>
  updateRider(riderId: string, update: RiderProfileUpdate): Promise<Rider>

  // Booking and trip status (each move is checked against lib/trip-rules.ts)
  quoteTrip(input: QuoteInput): Promise<RideQuote>
  /** Minutes until the nearest free car could reach the pickup, per ride type. Riders never see where drivers are. */
  getPickupEtas(pickup: PlaceId, types: TripType[]): Promise<Partial<Record<TripType, number>>>
  createBooking(input: BookingInput): Promise<Trip>
  /** The open queue is for platform admins. byAdminId is for the mock; Supabase checks the signed-in person. */
  assignDriver(tripId: string, driverId: string, byAdminId?: string): Promise<Trip>
  /** Platform admins, or a firm admin for a trip already given to their firm, to their own drivers. */
  reassignDriver(tripId: string, driverId: string, byAdminId?: string): Promise<Trip>
  respondOffer(offerId: string, accept: boolean): Promise<Trip>
  driverArrived(tripId: string): Promise<Trip>
  /** The driver must enter the rider's 4-digit trip PIN. Five wrong tries block it; Ops can then help. */
  startTrip(tripId: string, pin: string): Promise<Trip>
  endTrip(tripId: string): Promise<Trip>
  cancelTrip(tripId: string, by: CancelledBy, reason: string): Promise<Trip>
  markNoDriverFound(tripId: string): Promise<Trip>

  // Payment and ratings
  riderMarkPaid(tripId: string): Promise<Trip>
  confirmPayment(tripId: string, received: boolean): Promise<Trip>
  rateTrip(tripId: string, rating: number, tags?: string[], comment?: string): Promise<Trip>
  rateRider(tripId: string, rating: number): Promise<Trip>

  // Fleet (Ops)
  addFirm(input: NewFirmInput): Promise<Firm>
  addDriver(input: NewDriverInput): Promise<Driver>
  addCar(input: NewCarInput): Promise<Car>
  setDriverApproval(driverId: string, approval: Exclude<DriverApproval, "pending">): Promise<Driver>
  /** Platform admins only. */
  reviewDocument(input: DocumentReviewInput): Promise<ComplianceDocument>

  // Companies and staff (Ops and the company portal)
  addCompany(input: NewCompanyInput): Promise<Company>
  /** Adds a person to a company: links their rider account by phone, or creates one. */
  addStaff(companyId: string, input: NewStaffInput): Promise<Rider>
  /** Unlinks a person from the company and its commute routes. Their account and past trips stay. */
  removeStaff(companyId: string, riderId: string): Promise<Rider>

  // Invoices (totals are calculated here, or in Postgres generate_invoices, never on screens)
  generateInvoices(period: string): Promise<InvoiceRun>
  setInvoiceStatus(kind: "fee" | "company", invoiceId: string, status: InvoiceStatus): Promise<FeeInvoice | CompanyInvoice>
  /**
   * Platform admins only: correct a completed trip's fare (0 voids it), with a reason. The platform fee follows
   * at the trip's fee rate. Sent invoices stay as they are; the difference goes on the next invoice.
   */
  correctTripFare(input: FareCorrectionInput): Promise<Trip>

  // Team (Ops settings)
  addAdmin(input: NewAdminInput): Promise<AdminUser>
  removeAdmin(adminId: string, byAdminId: string): Promise<void>

  // Drivers
  signInDriver(input: { phone: string; code?: string }): Promise<Driver>
  getDriverTrips(driverId: string): Promise<Trip[]>
  getDriverJob(tripId: string, driverId: string): Promise<DriverJob | undefined>
  /** Send a new document for review. With Supabase the file goes to the private documents bucket; the mock keeps no files. */
  submitDocument(driverId: string, type: DocumentType, expiryDate: string, file?: Blob): Promise<Driver>
  /** A signed link to a document's file that works for 60 seconds, or undefined when there is no file. */
  getDocumentFileUrl(owner: "driver" | "car", ownerId: string, type: DocumentType): Promise<string | undefined>
  setDriverPresence(driverId: string, presence: Exclude<DriverPresence, "on_trip">): Promise<Driver>

  // Pricing
  setActivePlan(name: PlanName): Promise<PricingConfig>
  updatePlan(name: PlanName, values: Partial<Pick<PricingPlan, "firstKm" | "perKm" | "sharedSeatPercent">>): Promise<PricingConfig>
  updateAirportZones(zones: AirportZone[]): Promise<PricingConfig>
  setFirmFee(firmId: string, feePercent: PlatformFeePercent): Promise<Firm>
  /** A firm's own hire rates, set by its firm admin (or a platform admin). A rate left out means the firm does not offer that hire. */
  setFirmRates(firmId: string, rates: FirmRates): Promise<Firm>

  // Incidents
  reportIncident(input: Pick<Incident, "type" | "description"> & { tripId?: string; reportedBy?: string }): Promise<Incident>
  updateIncident(incidentId: string, update: { status?: IncidentStatus; note?: string }): Promise<Incident>

  // ── Phase 6B additions ──
  // 1. Notifications (in-app centre; browser push through the service worker). Each person can mute types.
  getNotifications(viewer: Viewer): Promise<AppNotification[]>
  markNotificationsRead(viewer: Viewer, ids?: string[]): Promise<void>
  getNotificationMutes(viewer: Viewer): Promise<NotificationType[]>
  setNotificationMute(viewer: Viewer, type: NotificationType, muted: boolean): Promise<void>
  savePushSubscription(viewer: Viewer, subscription: PushSubscriptionInput): Promise<void>
  deletePushSubscription(endpoint: string): Promise<void>

  // 2. Trip PIN: the rider sees it; the driver enters it to start the trip (startTrip).
  getTripPin(tripId: string): Promise<string | undefined>

  // 3 and 4. Chat: rider and driver, and company admin and driver on company-billed trips. Active trips only (or 24 h after a lost-item report).
  getChat(tripId: string, channel: ChatChannel): Promise<ChatMessage[]>
  sendChat(input: SendChatInput): Promise<ChatMessage>

  // 5. Favourite drivers
  getFavouriteDrivers(riderId?: string): Promise<FavouriteDriver[]>
  setFavouriteDriver(riderId: string, driverId: string, favourite: boolean): Promise<void>

  // 6. Driver preferences (ride types, heading home)
  getDriverPreferences(): Promise<DriverPreferences[]>
  setDriverPreferences(driverId: string, preferences: Omit<DriverPreferences, "driverId">): Promise<DriverPreferences>

  // 7. Busy areas for the driver home screen
  getBusyAreas(): Promise<BusyArea[]>
  /** Free cars for the map. Works signed out. */
  getFreeCars(): Promise<FreeCar[]>

  // 8. Live trip sharing: a read-only page with a signed token that stops working when the trip ends.
  createTripShare(tripId: string): Promise<string>
  revokeTripShares(tripId: string): Promise<void>
  getSharedTrip(token: string): Promise<SharedTripView | undefined>

  // 9. Lost and found
  getLostItems(): Promise<LostItem[]>
  reportLostItem(tripId: string, description: string): Promise<LostItem>
  updateLostItem(itemId: string, status: LostItemStatus): Promise<LostItem>

  // 10. Bonuses (tracking only) and settings
  getSettings(): Promise<AppSettings>
  setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<AppSettings>
  getBonusTargets(): Promise<BonusTarget[]>
  saveBonusTarget(input: BonusTargetInput): Promise<BonusTarget>
  getBonusProgress(driverId: string): Promise<BonusProgress[]>

  // 11. Reward points (tracking only, no redemption)
  getRewardPoints(riderId: string): Promise<RewardPoints>

  // 12. Tips: straight to the driver's own MoMo number. Flyt never holds the money.
  getTipDetails(tripId: string): Promise<TipDetails | undefined>
  recordTip(tripId: string, amount: number): Promise<Tip>
  getTips(): Promise<Tip[]>
  setFirmTips(firmId: string, enabled: boolean): Promise<Firm>
  setTipSettings(driverId: string, input: TipSettingsInput): Promise<Driver>

  /** Mock only: put the demo data back to its starting state. */
  resetDemo?(): Promise<void>
}
