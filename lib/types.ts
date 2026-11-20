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
export type DocumentReview = "on_file" | "missing" | "pending_review" | "rejected"
/** Status shown in the UI (see documentStatus in lib/documents.ts). */
export type DocumentStatus = "valid" | "expiring_soon" | "expired" | "missing" | "pending_review" | "rejected"
export type OfferStatus = "pending" | "accepted" | "declined" | "expired"
export type InvoiceStatus = "draft" | "sent" | "paid"
export type IncidentType = "safety" | "complaint" | "damage" | "lost_item" | "other"
export type IncidentStatus = "open" | "investigating" | "closed"
export type AdminRole = "platform_admin" | "firm_admin" | "company_admin"
export type PlanName = "Baseline" | "Test"

export interface ComplianceDocument {
  id: string
  type: DocumentType
  expiryDate?: string
  review: DocumentReview
  /** Why Flyt Operations rejected the document. Shown to the driver. */
  rejectReason?: string
  /** A file was sent (Supabase only). Opened through a short-lived signed link. */
  hasFile?: boolean
}
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
  /** Riders may tip this firm's drivers by MoMo (drivers opt in). Off by default. */
  tipsEnabled?: boolean
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
  /** Suspended while on a trip: the suspension takes effect when that trip ends. */
  suspendAfterTrip?: boolean
  /** The driver opted in to tips. */
  tipsOptIn?: boolean
  /** The driver's own MoMo number for tips. Shown to a rider only on the tip screen, for 24 hours after a trip. */
  tipMomoNumber?: string
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
  /** Fare corrections made after the trip ended, oldest first. */
  corrections?: FareCorrection[]
}

export interface JobOffer { id: string; tripId: string; driverId: string; status: OfferStatus; createdAt: string; expiresAt: string }

export interface CommuteRoute { id: string; companyId: string; name: string; stops: PlaceId[]; departureTimes: string[]; seatsPerCar: number; riderIds: string[] }

/** One trip on an invoice, at its fare and platform fee when the invoice was made. */
export interface InvoiceLine { tripId: string; fare: number; fee: number }
/**
 * A change to a trip from an earlier, already sent invoice (a corrected or voided fare).
 * Sent invoices never change, so the difference goes on the next invoice as an adjustment line.
 * fare and fee are the differences (negative when the trip now costs less).
 */
export interface InvoiceAdjustment { tripId: string; fromPeriod: string; fare: number; fee: number; reason: string }
/** Issued by Flyt Ltd to a firm for its platform fees. period is "YYYY-MM" in Kigali time. Totals include the adjustment lines. */
export interface FeeInvoice { id: string; firmId: string; period: string; tripCount: number; faresTotal: number; feeTotal: number; status: InvoiceStatus; lines: InvoiceLine[]; adjustments: InvoiceAdjustment[] }
export interface CompanyInvoice { id: string; companyId: string; period: string; tripCount: number; total: number; status: InvoiceStatus; lines: InvoiceLine[]; adjustments: InvoiceAdjustment[] }

/** A platform admin's correction to a completed trip's fare. A fare of 0 voids the trip. Kept as a record on the trip. */
export interface FareCorrection { at: string; byAdminId: string; fromFare: number; toFare: number; reason: string; /** The trip's fee rate, kept so a voided trip can be corrected again. */ feePercent: number }

export interface Incident { id: string; tripId?: string; type: IncidentType; description: string; status: IncidentStatus; notes: string[]; reportedBy?: string; createdAt: string }

export interface PricingPlan { name: PlanName; firstKm: number; perKm: number; sharedSeatPercent: number; isActive: boolean }
/** Fixed price for a trip between the airport and a place. No price means the private-ride formula is used. */
export interface AirportZone { placeId: PlaceId; price?: number }
export interface PricingConfig { plans: PricingPlan[]; airportZones: AirportZone[] }

export interface AdminUser { id: string; name: string; phone: string; role: AdminRole; firmId?: string; companyId?: string }

// ── Additions (Phase 6B): notifications, chat, sharing, lost and found, favourites, preferences,
// busy areas, bonuses, points, tips, verified badge. All free and code-only.

export type NotificationType =
  | "offer_new"
  | "trip_cancelled_by_rider"
  | "scheduled_reminder"
  | "document_expiring_30"
  | "document_expiring_7"
  | "document_approved"
  | "document_rejected"
  | "account_approved"
  | "account_suspended"
  | "payment_confirmed"
  | "driver_assigned"
  | "driver_arriving"
  | "driver_arrived"
  | "trip_started"
  | "receipt_ready"
  | "invoice_sent"
  | "incident_opened"
  | "request_waiting"
  | "chat_message"

export interface AppNotification { id: string; type: NotificationType; title: string; body: string; link?: string; tripId?: string; createdAt: string; readAt?: string }

/** Who is looking: the mock needs it (it has no sign-in sessions); Supabase uses the signed-in person instead. */
export interface Viewer { kind: "rider" | "driver" | "admin"; id: string }

export type ChatChannel = "rider_driver" | "company_driver"
export type ChatSender = "rider" | "driver" | "company"
export interface ChatMessage { id: string; tripId: string; channel: ChatChannel; sender: ChatSender; senderId: string; body: string; quickReply: boolean; createdAt: string }

export interface DriverPreferences { driverId: string; rideTypes: TripType[]; headingHomeZone?: PlaceId; headingHomeUntil?: string }
export interface FavouriteDriver { riderId: string; driverId: string; createdAt: string }
export interface BusyArea { zone: PlaceId; waiting: number }

/** A free car for the map: an opaque key and its zone. No driver, car or firm details. */
export interface FreeCar { key: string; zone: PlaceId }

/** The public trip-sharing page: no phone numbers, no fare. */
export interface SharedTripView {
  status: TripStatus
  type: TripType
  pickup: PlaceId
  dropoff: PlaceId
  acceptedAt?: string
  arrivedAt?: string
  startedAt?: string
  pickupEtaMinutes?: number
  driverFirstName?: string
  car?: { plate: string; make: string; model: string; colour: string }
}

export type LostItemStatus = "open" | "found" | "returned" | "not_found"
export interface LostItem { id: string; tripId: string; riderId: string; incidentId: string; description: string; status: LostItemStatus; chatOpenUntil: string; createdAt: string }

export type BonusPeriod = "day" | "week" | "month"
export interface BonusTarget { id: string; name: string; metric: "completed_trips"; period: BonusPeriod; target: number; firmId?: string; active: boolean; createdAt: string }
export interface BonusProgress { targetId: string; name: string; period: BonusPeriod; target: number; done: number }

export interface AppSettings { bonusesEnabled: boolean; pointsPer1000Rwf: number; pointsRedemptionEnabled: boolean; requestWaitingMinutes: number; scheduledReminderMinutes: number }

export interface RewardPointsEntry { tripId?: string; points: number; reason: string; createdAt: string }
export interface RewardPoints { total: number; entries: RewardPointsEntry[] }

export interface TipDetails { driverFirstName: string; momoNumber: string; until: string; alreadyTipped: boolean }
export interface Tip { id: string; tripId: string; riderId: string; driverId: string; amount: number; riderSentAt: string }

export interface PushSubscriptionInput { endpoint: string; p256dh: string; auth: string }
