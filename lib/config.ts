// Features that are not part of version 1 stay off. Anything behind a false flag is hidden.
export const featureFlags = { publicSharedRides: false, privateOwnerCars: false, cardPayments: false } as const

/** "mock" (default) runs the demo in the browser with no backend. "supabase" uses the Supabase adapter. */
export const dataSource: "mock" | "supabase" = process.env.NEXT_PUBLIC_DATA_SOURCE === "supabase" ? "supabase" : "mock"

export const demoRiderId = "rider-1"
/** Mock demo only: after a rider books, assign the nearest free driver and accept for them, as Part 1 did before Dispatch and the driver app exist. */
export const demoAutoDispatch = true
export const demoEmergencyNumber = "+250 788 000 000"
export const supportEmail = "hello@flyt.rw"

/** Seconds a driver has to accept a job offer. */
export const offerSeconds = 20
/** Platform fee choices an operator can set per firm. */
export const platformFeeChoices = [10, 12, 15] as const
/** Fee for new firms unless the operator picks another. */
export const defaultPlatformFee = 12
