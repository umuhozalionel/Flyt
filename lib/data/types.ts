import type { FareQuote } from "../pricing"
import type {
  AdminUser,
  AirportZone,
  Car,
  CancelledBy,
  CommuteRoute,
  Company,
  CompanyInvoice,
  Driver,
  DriverPresence,
  EmergencyContact,
  FeeInvoice,
  Firm,
  Incident,
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

export interface TripAssignment { trip: Trip; driver?: Driver; car?: Car; firm?: Firm; rider?: Rider }

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

  // Drivers
  setDriverPresence(driverId: string, presence: Exclude<DriverPresence, "on_trip">): Promise<Driver>

  // Pricing
  setActivePlan(name: PlanName): Promise<PricingConfig>
  updatePlan(name: PlanName, values: Partial<Pick<PricingPlan, "firstKm" | "perKm" | "sharedSeatPercent">>): Promise<PricingConfig>
  updateAirportZones(zones: AirportZone[]): Promise<PricingConfig>
  setFirmFee(firmId: string, feePercent: PlatformFeePercent): Promise<Firm>

  // Incidents
  reportIncident(input: Pick<Incident, "type" | "description"> & { tripId?: string; reportedBy?: string }): Promise<Incident>

  /** Mock only: put the demo data back to its starting state. */
  resetDemo?(): Promise<void>
}
