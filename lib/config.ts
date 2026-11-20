// Features that are not part of version 1 stay off. Anything behind a false flag is hidden.
export const featureFlags = { publicSharedRides: false, privateOwnerCars: false, cardPayments: false } as const

/** "mock" (default) runs the demo in the browser with no backend. "supabase" uses the Supabase adapter. */
export const dataSource: "mock" | "supabase" = process.env.NEXT_PUBLIC_DATA_SOURCE === "supabase" ? "supabase" : "mock"

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321"
/** Only the public anon key. The service-role key never goes in client code. */
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
/** Public VAPID key for browser push (free Web Push). The private key stays on the server (supabase/functions/.env). */
export const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""
/** True for the Supabase started on this computer by the CLI. */
export const isLocalSupabase = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(supabaseUrl)
/**
 * Dev-only email and password sign-in for seeded people. Off by default (NEXT_PUBLIC_DEV_SIGNIN=false), and it can
 * only switch on against a local Supabase, so it can never be on in production.
 */
export const devSignIn = dataSource === "supabase" && process.env.NEXT_PUBLIC_DEV_SIGNIN === "true" && isLocalSupabase

export const demoRiderId = "rider-1"
/**
 * Demo helpers (auto-assign new bookings, accept or drive a trip for the driver) exist only with mock data.
 * They are off by default and switched on from Dispatch. They never run in Supabase mode.
 */
export const demoAutoDispatch = dataSource === "mock"
export const demoEmergencyNumber = "+250 788 000 000"
export const supportEmail = "hello@flyt.rw"
/** The contact link on the start page. */
export const contactEmail = "Muhozalionel@gmail.com"

/** Seconds a driver has to accept a job offer. */
export const offerSeconds = 20
/** Platform fee choices an operator can set per firm. */
export const platformFeeChoices = [10, 12, 15] as const
/** Fee for new firms unless the operator picks another. */
export const defaultPlatformFee = 12

/**
 * Map styles (MapLibre). OpenFreeMap is free with no key; any MapLibre style URL works here, so the provider can be
 * swapped later. If a style or its tiles fail to load, MapView falls back to a plain built-in map of our places.
 */
export const mapStyleUrl = process.env.NEXT_PUBLIC_MAP_STYLE_URL || "https://tiles.openfreemap.org/styles/liberty"
/** Used at night in Kigali and when the app is in dark mode. */
export const mapStyleDarkUrl = process.env.NEXT_PUBLIC_MAP_STYLE_DARK_URL || "https://tiles.openfreemap.org/styles/dark"
