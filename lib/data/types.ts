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
} from "../types"

/** Change topics. A subscriber is called when data in one of its topics changes, in this tab or another. */
export type Topic = "firms" | "companies" | "riders" | "drivers" | "cars" | "trips" | "offers" | "routes" | "invoices" | "incidents" | "pricing" | "admins"

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
export interface DriverJob { trip: Trip; rider: RiderForDriver; car?: Car; firm?: Firm }

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

  // Riders
  signInRider(input: { phone: string; name?: string; consent: boolean; joinCode?: string }): Promise<Rider>
  updateRider(riderId: string, update: RiderProfileUpdate): Promise<Rider>

  // Booking and trip status (each move is checked against lib/trip-rules.ts)
  quoteTrip(input: QuoteInput): Promise<RideQuote>
  /** Minutes until the nearest free car could reach the pickup, per ride type. Riders never see where drivers are. */
  getPickupEtas(pickup: PlaceId, types: TripType[]): Promise<Partial<Record<TripType, number>>>
  createBooking(input: BookingInput): Promise<Trip>
  assignDriver(tripId: string, driverId: string): Promise<Trip>
  reassignDriver(tripId: string, driverId: string): Promise<Trip>
  respondOffer(offerId: string, accept: boolean): Promise<Trip>
  driverArrived(tripId: string): Promise<Trip>
  startTrip(tripId: string): Promise<Trip>
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

  // Team (Ops settings)
  addAdmin(input: NewAdminInput): Promise<AdminUser>
  removeAdmin(adminId: string, byAdminId: string): Promise<void>

  // Drivers
  signInDriver(input: { phone: string }): Promise<Driver>
  getDriverTrips(driverId: string): Promise<Trip[]>
  getDriverJob(tripId: string, driverId: string): Promise<DriverJob | undefined>
  /** Send a new document for review (the file itself is not uploaded in this version). */
  submitDocument(driverId: string, type: DocumentType, expiryDate: string): Promise<Driver>
  setDriverPresence(driverId: string, presence: Exclude<DriverPresence, "on_trip">): Promise<Driver>

  // Pricing
  setActivePlan(name: PlanName): Promise<PricingConfig>
  updatePlan(name: PlanName, values: Partial<Pick<PricingPlan, "firstKm" | "perKm" | "sharedSeatPercent">>): Promise<PricingConfig>
  updateAirportZones(zones: AirportZone[]): Promise<PricingConfig>
  setFirmFee(firmId: string, feePercent: PlatformFeePercent): Promise<Firm>

  // Incidents
  reportIncident(input: Pick<Incident, "type" | "description"> & { tripId?: string; reportedBy?: string }): Promise<Incident>
  updateIncident(incidentId: string, update: { status?: IncidentStatus; note?: string }): Promise<Incident>

  /** Mock only: put the demo data back to its starting state. */
  resetDemo?(): Promise<void>
}
