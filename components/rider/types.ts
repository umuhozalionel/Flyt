import type { TripAssignment } from "@/lib/api"
import type { PaymentMethod, PlaceId, TripType } from "@/lib/types"

export type Screen = "home" | "book" | "finding" | "trip" | "complete" | "receipt" | "trips" | "account" | "signin"

export interface BookingDraft {
  pickup: PlaceId
  dropoff: PlaceId
  type: TripType
  payment: PaymentMethod
  schedule: boolean
  scheduledFor: string
  hireQuantity: number
}

export type { TripAssignment }
