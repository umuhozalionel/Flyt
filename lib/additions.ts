import { kigaliDay, kigaliMonth } from "./time"
import { weekStart } from "./driver"
import type {
  AppSettings,
  BonusProgress,
  BonusTarget,
  BusyArea,
  ChatChannel,
  ChatSender,
  Company,
  Driver,
  DriverPreferences,
  Firm,
  LostItem,
  NotificationType,
  PlaceId,
  Rider,
  RewardPoints,
  Trip,
  TripType,
} from "./types"

// Rules for the Phase 6B additions. Pure functions: the mock data source uses them, tests check them,
// and the same rules run in Postgres for Supabase (supabase/migrations/20261119000900_additions.sql).

export const tripTypes: TripType[] = ["private", "shared_commute", "hourly", "daily", "airport"]

export const defaultSettings: AppSettings = { bonusesEnabled: false, pointsPer1000Rwf: 1, pointsRedemptionEnabled: false, requestWaitingMinutes: 5, scheduledReminderMinutes: 30 }

// ── Trip PIN ─────────────────────────────────────────────────────────────────────────────
export const PIN_MAX_TRIES = 5

/** A random 4-digit trip PIN. */
export function newPin(random: () => number = Math.random) {
  return String(Math.floor(random() * 10_000)).padStart(4, "0")
}

// ── Chat ─────────────────────────────────────────────────────────────────────────────────
const activeChat: Trip["status"][] = ["assigned", "driver_arriving", "driver_arrived", "in_progress"]

/** Chat is open while the trip is active, or for 24 hours after the rider reports a lost item. */
export function chatOpen(trip: Trip, lostItems: LostItem[], now: number = Date.now()) {
  return activeChat.includes(trip.status) || lostItems.some((item) => item.tripId === trip.id && Date.parse(item.chatOpenUntil) > now)
}

/** Who a person is in a trip's chat channel, or undefined when they may not use it (rule b for companies). */
export function chatRole(trip: Trip, channel: ChatChannel, who: { riderId?: string; driverId?: string; companyId?: string }): ChatSender | undefined {
  if (channel === "rider_driver" && who.riderId && trip.riderId === who.riderId) return "rider"
  if (who.driverId && trip.driverId === who.driverId) return "driver"
  if (channel === "company_driver" && who.companyId && trip.paymentMethod === "company_account" && trip.companyId === who.companyId) return "company"
  return undefined
}

/** Rule c: no phone numbers in chat (7 or more digits, spaces, dots, dashes and brackets ignored). */
export function hasPhoneNumber(body: string) {
  return /\d{7,}/.test(body.replace(/[\s.\-()+]/g, ""))
}

/** Quick replies by id (texts in lib/i18n: chat.quick.<id>). */
export const quickReplies: Record<ChatSender, string[]> = {
  rider: ["atGate", "twoMinutes", "comingOut", "pleaseWait"],
  driver: ["imHere", "twoMinutes", "mainEntrance", "traffic"],
  company: ["confirmPickup", "riderOnWay", "thanks"],
}

// ── Dispatch: preferences, heading home, favourites ─────────────────────────────────────
export function preferencesOf(driverId: string, all: DriverPreferences[]): DriverPreferences {
  return all.find((item) => item.driverId === driverId) ?? { driverId, rideTypes: tripTypes }
}

export function headingHome(prefs: DriverPreferences, now: number = Date.now()) {
  return !!prefs.headingHomeZone && !!prefs.headingHomeUntil && Date.parse(prefs.headingHomeUntil) > now
}

/**
 * Whether dispatch suggestions may include this driver for a trip: they accept the ride type, and a driver
 * heading home is only suggested when the drop-off is their home area.
 */
export function prefsAllow(trip: Pick<Trip, "type" | "dropoff">, prefs: DriverPreferences, now: number = Date.now()) {
  if (!prefs.rideTypes.includes(trip.type)) return false
  if (headingHome(prefs, now) && prefs.headingHomeZone !== trip.dropoff) return false
  return true
}

/** Heading home lasts up to 12 hours. */
export const HEADING_HOME_MAX_HOURS = 12

// ── Busy areas ───────────────────────────────────────────────────────────────────────────
/** Waiting requests per pickup zone (and scheduled rides due within the hour). Counts only. */
export function busyAreas(trips: Trip[], now: number = Date.now()): BusyArea[] {
  const counts = new Map<PlaceId, number>()
  for (const trip of trips) {
    const soon = trip.status === "scheduled" && trip.scheduledFor && Date.parse(trip.scheduledFor) < now + 3_600_000
    if (trip.status === "requested" || soon) counts.set(trip.pickup, (counts.get(trip.pickup) ?? 0) + 1)
  }
  return [...counts].map(([zone, waiting]) => ({ zone, waiting })).sort((a, b) => b.waiting - a.waiting || a.zone.localeCompare(b.zone))
}

// ── Reward points (tracking only) ───────────────────────────────────────────────────────
/** Points for a completed fare: one block of points for each full Rwf 1,000. */
export function pointsForFare(fare: number, perThousand: number) {
  return fare >= 1000 && perThousand > 0 ? Math.floor(fare / 1000) * perThousand : 0
}

export function rewardPoints(riderId: string, trips: Trip[], settings: AppSettings): RewardPoints {
  const entries = trips
    .filter((trip) => trip.riderId === riderId && trip.status === "completed" && trip.completedAt)
    .map((trip) => ({ tripId: trip.id, points: pointsForFare(trip.fare, settings.pointsPer1000Rwf), reason: "Completed trip", createdAt: trip.completedAt! }))
    .filter((entry) => entry.points > 0)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return { total: entries.reduce((sum, entry) => sum + entry.points, 0), entries }
}

// ── Bonuses (tracking only, nothing is paid) ────────────────────────────────────────────
export function bonusProgress(driver: Pick<Driver, "id" | "firmId">, targets: BonusTarget[], trips: Trip[], settings: AppSettings, now: Date = new Date()): BonusProgress[] {
  if (!settings.bonusesEnabled) return []
  const today = kigaliDay(now)
  const done = trips.filter((trip) => trip.driverId === driver.id && trip.status === "completed" && trip.completedAt)
  const inPeriod = (trip: Trip, period: BonusTarget["period"]) => {
    const day = kigaliDay(trip.completedAt!)
    if (period === "day") return day === today
    if (period === "week") return day >= weekStart(today) && day <= today
    return kigaliMonth(trip.completedAt!) === kigaliMonth(now)
  }
  return targets
    .filter((target) => target.active && (!target.firmId || target.firmId === driver.firmId))
    .map((target) => ({ targetId: target.id, name: target.name, period: target.period, target: target.target, done: done.filter((trip) => inPeriod(trip, target.period)).length }))
}

// ── Tips (Flyt never holds the money) ───────────────────────────────────────────────────
export const TIP_MAX = 10_000
export const TIP_WINDOW_HOURS = 24
export const tipChoices = [500, 1000, 2000]

/** Whether the rider may see the driver's MoMo number on the tip screen now. */
export function tipOpen(trip: Trip, driver: Driver | undefined, firm: Firm | undefined, now: number = Date.now()) {
  if (trip.status !== "completed" || !trip.completedAt) return false
  if (now > Date.parse(trip.completedAt) + TIP_WINDOW_HOURS * 3_600_000) return false
  return !!(driver?.tipsOptIn && driver.tipMomoNumber && firm?.tipsEnabled)
}

export function checkTipAmount(amount: number) {
  if (!Number.isInteger(amount) || amount < 1 || amount > TIP_MAX) throw new Error("A tip is from Rwf 1 to Rwf 10,000")
}

// ── Verified badge ───────────────────────────────────────────────────────────────────────
/** A company rider: linked to an active client company. */
export function isVerifiedRider(rider: Pick<Rider, "companyId"> | undefined, companies: Pick<Company, "id" | "status">[]) {
  return !!rider?.companyId && companies.some((company) => company.id === rider.companyId && company.status === "active")
}

// ── Notifications ────────────────────────────────────────────────────────────────────────
/** The types each person can get, for the mute settings. */
export const notificationTypesFor: Record<"rider" | "driver" | "admin", NotificationType[]> = {
  driver: ["offer_new", "trip_cancelled_by_rider", "scheduled_reminder", "document_expiring_30", "document_expiring_7", "document_approved", "document_rejected", "account_approved", "account_suspended", "payment_confirmed", "chat_message"],
  rider: ["driver_assigned", "driver_arriving", "driver_arrived", "trip_started", "receipt_ready", "scheduled_reminder", "chat_message"],
  admin: ["invoice_sent", "incident_opened", "request_waiting", "chat_message"],
}

/** Lost-item report window. */
export const LOST_ITEM_DAYS = 30
export const LOST_ITEM_CHAT_HOURS = 24
