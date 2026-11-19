// Shared data types. Every money value is a whole number of Rwandan francs (Rwf).
// Every timestamp is an ISO 8601 string in UTC; screens show it in Africa/Kigali time.

export type Language = "en" | "rw" | "fr"

export type PlaceId =
  | "kicukiro"
  | "remera"
  | "kimihurura"
  | "kacyiru"
  | "nyamirambo"
  | "gisozi"
  | "nyabugogo"
  | "city-centre"
  | "kcc"
  | "airport"

export interface Place { id: PlaceId; name: string; lat?: number; lng?: number }
export interface PlaceDistance { from: PlaceId; to: PlaceId; km: number }

export type FirmType = "taxi" | "rental"
export type FirmStatus = "active" | "pending_licence" | "suspended"
export type PlatformFeePercent = 10 | 12 | 15
export type CompanyStatus = "active" | "pending"
export type DriverPresence = "offline" | "online" | "on_trip"
export type DriverApproval = "pending" | "approved" | "suspended"
export type CarAvailability = "available" | "in_use" | "out_of_service"
export type TripType = "private" | "shared_commute" | "hourly" | "daily" | "airport"
export type TripStatus =
  | "requested"
  | "scheduled"
  | "assigned"
  | "driver_arriving"
  | "driver_arrived"
  | "in_progress"
  | "completed"
  | "cancelled_by_rider"
  | "cancelled_by_driver"
  | "no_driver_found"
export type CancelledBy = "rider" | "driver" | "ops" | "system"
export type PaymentMethod = "momo" | "airtel" | "company_account"
export type PaymentStatus = "pending" | "paid" | "billed_to_company" | "failed"
export type DocumentType =
  | "driving_licence"
  | "national_id"
  | "criminal_record"
  | "professional_certificate"
  | "registration"
  | "inspection"
  | "insurance"
/** Stored review state. The status shown to people is worked out from this and the expiry date. */
export type DocumentReview = "on_file" | "missing" | "pending_review"
/** Status shown in the UI (see documentStatus in lib/documents.ts). */
export type DocumentStatus = "valid" | "expiring_soon" | "expired" | "missing" | "pending_review"
export type OfferStatus = "pending" | "accepted" | "declined" | "expired"
export type InvoiceStatus = "draft" | "sent" | "paid"
export type IncidentType = "safety" | "complaint" | "damage" | "other"
export type IncidentStatus = "open" | "investigating" | "closed"
export type AdminRole = "platform_admin" | "firm_admin" | "company_admin"
export type PlanName = "Baseline" | "Test"

export interface ComplianceDocument { id: string; type: DocumentType; expiryDate?: string; review: DocumentReview }
export interface SavedPlace { id: string; label: string; placeId: PlaceId }
export interface EmergencyContact { id: string; name: string; phone: string }

export interface Rider {
  id: string
  name: string
  phone: string
  language: Language
  companyId?: string
  savedPlaces: SavedPlace[]
  emergencyContacts: EmergencyContact[]
  consentAt?: string
  createdAt: string
}

export interface Company { id: string; name: string; contactName: string; phone: string; staffCount: number; status: CompanyStatus; joinCode: string }

export interface Firm {
  id: string
  name: string
  type: FirmType
  ruraLicenceNo: string
  licenceExpiry: string
  tin: string
  momoMerchantCode: string
  airtelMerchantCode: string
  feePercent: PlatformFeePercent
  hourlyRate?: number
  dailyRate?: number
  status: FirmStatus
}

export interface Driver {
  id: string
  firmId: string
  name: string
  phone: string
  rating: number
  status: DriverPresence
  approval: DriverApproval
  zone: PlaceId
  carId?: string
  documents: ComplianceDocument[]
}

export interface Car {
  id: string
  firmId: string
  plate: string
  make: string
  model: string
  colour: string
  year: number
  seats: number
  power: "electric" | "fuel"
  availability: CarAvailability
  zone: PlaceId
  documents: ComplianceDocument[]
}

export interface Trip {
  id: string
  type: TripType
  riderId: string
  companyId?: string
  firmId: string
  driverId?: string
  carId?: string
  pickup: PlaceId
  dropoff: PlaceId
  distanceKm: number
  /** Hours for hourly hire, days for daily hire. */
  hireQuantity?: number
  scheduledFor?: string
  fare: number
  platformFee: number
  planName: PlanName
  status: TripStatus
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus
  receiptNo?: string
  riderRating?: number
  ratingTags?: string[]
  ratingComment?: string
  driverRating?: number
  cancelReason?: string
  cancelledBy?: CancelledBy
  commuteRouteId?: string
  createdAt: string
  updatedAt: string
  assignedAt?: string
  acceptedAt?: string
  arrivedAt?: string
  startedAt?: string
  completedAt?: string
  cancelledAt?: string
  /** The rider tapped "I have paid"; waiting for the driver or firm to confirm. */
  riderPaidAt?: string
  paidAt?: string
}

export interface JobOffer { id: string; tripId: string; driverId: string; status: OfferStatus; createdAt: string; expiresAt: string }

export interface CommuteRoute { id: string; companyId: string; name: string; stops: PlaceId[]; departureTimes: string[]; seatsPerCar: number; riderIds: string[] }

/** Issued by Flyt Ltd to a firm for its platform fees. period is "YYYY-MM" in Kigali time. */
export interface FeeInvoice { id: string; firmId: string; period: string; tripCount: number; faresTotal: number; feeTotal: number; status: InvoiceStatus }
export interface CompanyInvoice { id: string; companyId: string; period: string; tripCount: number; total: number; status: InvoiceStatus }

export interface Incident { id: string; tripId?: string; type: IncidentType; description: string; status: IncidentStatus; notes: string[]; reportedBy?: string; createdAt: string }

export interface PricingPlan { name: PlanName; firstKm: number; perKm: number; sharedSeatPercent: number; isActive: boolean }
/** Fixed price for a trip between the airport and a place. No price means the private-ride formula is used. */
export interface AirportZone { placeId: PlaceId; price?: number }
export interface PricingConfig { plans: PricingPlan[]; airportZones: AirportZone[] }

export interface AdminUser { id: string; name: string; phone: string; role: AdminRole; firmId?: string; companyId?: string }
