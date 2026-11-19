export type Language = "en" | "rw" | "fr"
export type FirmStatus = "active" | "pending_licence" | "suspended"
export type TripType = "private" | "shared_commute" | "hourly" | "daily" | "airport"
export type TripStatus = "requested" | "scheduled" | "assigned" | "driver_arriving" | "driver_arrived" | "in_progress" | "completed" | "cancelled_by_rider" | "cancelled_by_driver" | "no_driver_found"
export type PaymentMethod = "momo" | "airtel" | "company_account"
export type PaymentStatus = "pending" | "paid" | "billed_to_company" | "failed"
export type DocumentStatus = "valid" | "expiring_soon" | "expired" | "missing" | "pending_review"
export type DocumentType = "driving_licence" | "national_id" | "criminal_record" | "professional_certificate" | "registration" | "inspection" | "insurance"

export interface Document { type: DocumentType; expiryDate?: string; status: DocumentStatus }
export interface Rider { id: string; name: string; phone: string; language: Language; companyId?: string; savedPlaces: { label: string; address: string }[] }
export interface Company { id: string; name: string; contactName: string; phone: string; staffCount: number; status: "active" | "pending" }
export interface Firm { id: string; name: string; type: "taxi" | "rental"; ruraLicenceNo: string; licenceExpiry: string; tin: string; momoMerchantCode: string; airtelMerchantCode: string; feePercent: number; hourlyRate?: number; dailyRate?: number; status: FirmStatus }
export interface Driver { id: string; firmId: string; name: string; phone: string; rating: number; status: "offline" | "online" | "on_trip"; documents: Document[] }
export interface Car { id: string; firmId: string; plate: string; make: string; model: string; colour: string; year: number; seats: number; power: "electric" | "fuel"; documents: Document[] }
export interface Trip { id: string; type: TripType; riderId: string; companyId?: string; firmId: string; driverId?: string; carId?: string; pickup: string; dropoff: string; distanceKm: number; scheduledFor?: string; fare: number; platformFee: number; status: TripStatus; paymentMethod: PaymentMethod; paymentStatus: PaymentStatus; receiptNo?: string; riderRating?: number; driverRating?: number; createdAt: string; updatedAt: string }
export interface CommuteRoute { id: string; companyId: string; name: string; stops: string[]; departureTimes: string[]; seatsPerCar: number; riderIds: string[] }
export interface FeeInvoice { id: string; firmId: string; period: string; tripCount: number; faresTotal: number; feeTotal: number; status: "draft" | "sent" | "paid" }
export interface CompanyInvoice { id: string; companyId: string; period: string; tripCount: number; total: number; status: "draft" | "sent" | "paid" }
export interface Incident { id: string; tripId?: string; type: "safety" | "complaint" | "damage" | "other"; description: string; status: "open" | "investigating" | "closed"; createdAt: string }
export interface PricingPlan { name: "Baseline" | "Test"; firstKm: number; perKm: number; sharedSeatPercent: number; platformFeePercent: number; airportZones: { zone: string; price?: number }[] }
