"use client"

import Link from "next/link"
import { ArrowLeft, Clock3, Home, UserRound, WifiOff } from "lucide-react"
import { useCallback, useMemo, useState } from "react"
import { Logo } from "@/components/shared/logo"
import { Skeleton } from "@/components/shared/skeleton"
import { Toast, useToastMessage } from "@/components/shared/toast"
import * as api from "@/lib/api"
import { demoRiderId } from "@/lib/config"
import { initials } from "@/lib/format"
import { useLanguage, useT } from "@/lib/i18n"
import { firmsOffering, quoteFare } from "@/lib/pricing"
import { activeStatuses, cancelledStatuses } from "@/lib/trip-rules"
import { useAutoDispatch } from "@/lib/use-demo"
import { useLive, useOnline } from "@/lib/use-live"
import { useStored } from "@/lib/use-stored"
import type { Language, Trip, TripType } from "@/lib/types"
import { AccountScreen } from "./account-screen"
import { BookScreen, type OptionQuote } from "./book-screen"
import { CancelSheet } from "./cancel-sheet"
import { CompleteScreen } from "./complete-screen"
import { EmergencyContactsScreen } from "./emergency-contacts-screen"
import { FindingScreen } from "./finding-screen"
import { HomeScreen } from "./home-screen"
import { ReceiptScreen } from "./receipt-screen"
import { SavedPlacesScreen } from "./saved-places-screen"
import { SignInScreen } from "./sign-in-screen"
import { TripDetailScreen } from "./trip-detail-screen"
import { TripScreen } from "./trip-screen"
import { TripsScreen } from "./trips-screen"
import type { BookingDraft, Screen } from "./types"

const RIDER_KEY = "flyt-rider-id"
const SEARCH_MS = 2500

function errorText(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** The screen a trip opens on, from its status. */
function screenFor(trip: Trip): Screen {
  if (trip.status === "requested") return "finding"
  if (activeStatuses.includes(trip.status)) return "trip"
  return "detail"
}

/** Where a back arrow goes from each screen. */
const backTo: Partial<Record<Screen, Screen>> = { book: "home", detail: "trips", receipt: "home", places: "account", contacts: "account", signin: "account" }

export default function RiderApp() {
  const t = useT()
  const { setLanguage } = useLanguage()
  const online = useOnline()
  // Mock demo: Ops can turn this off on Dispatch to assign bookings by hand.
  const [autoAssign] = useAutoDispatch()
  const [screen, setScreen] = useState<Screen>("home")
  const [riderId, setRiderId] = useStored<string>(RIDER_KEY, demoRiderId)
  const [tripId, setTripId] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [draft, setDraftState] = useState<BookingDraft>({ pickup: "kimihurura", dropoff: "kcc", type: "private", payment: "momo", schedule: false, scheduledFor: "", hireQuantity: 1 })
  const { message, toast, clear } = useToastMessage()

  // Airport is only offered when one end is the airport; moving both ends away falls back to Private.
  const setDraft = useCallback(
    (update: Partial<BookingDraft>) =>
      setDraftState((current) => {
        const next = { ...current, ...update }
        if (next.type === "airport" && next.pickup !== "airport" && next.dropoff !== "airport") next.type = "private"
        return next
      }),
    [],
  )

  const riderData = useLive(() => api.getRider(riderId), ["riders"], [riderId])
  const companies = useLive(() => api.getCompanies(), ["companies"])
  const firms = useLive(() => api.getFirms(), ["firms"])
  const pricing = useLive(() => api.getPricing(), ["pricing"])
  const routes = useLive(() => api.getCommuteRoutes(), ["routes"])
  const trips = useLive(() => api.getRiderTrips(riderId), ["trips"], [riderId])
  const assignment = useLive(() => (tripId ? api.getTripAssignment(tripId) : Promise.resolve(undefined)), ["trips", "drivers", "cars", "firms"], [tripId])

  const rider = riderData.data
  const company = companies.data?.find((item) => item.id === rider?.companyId)
  const current = assignment.data?.trip.id === tripId ? assignment.data : undefined
  const bannerTrip = trips.data?.find((trip) => trip.status === "requested" || activeStatuses.includes(trip.status))
  const route = draft.type === "shared_commute" ? routes.data?.find((item) => item.companyId === company?.id && item.stops.includes(draft.pickup) && item.stops.includes(draft.dropoff)) : undefined

  // Follow the trip when its status changes elsewhere (Dispatch, the driver app, another tab).
  let shown: Screen = screen
  if (current) {
    const status = current.trip.status
    if (screen === "finding" && status !== "requested" && status !== "no_driver_found") shown = screenFor(current.trip)
    else if (screen === "trip" && status === "completed") shown = "complete"
    else if (screen === "trip" && (cancelledStatuses.includes(status) || status === "requested")) shown = status === "requested" ? "finding" : "detail"
  }

  // Price preview for each ride type, from the active plan and the firm that would run it.
  const quotes = useMemo(() => {
    if (!pricing.data || !firms.data) return undefined
    const types: TripType[] = company ? ["private", "shared_commute", "airport", "hourly", "daily"] : ["private", "airport", "hourly", "daily"]
    const result: Partial<Record<TripType, OptionQuote>> = {}
    for (const type of types) {
      try {
        const firm = firmsOffering(type, firms.data)[0]
        if (!firm) throw new Error(t("rider.book.unavailable"))
        const quote = quoteFare({ type, pickup: draft.pickup, dropoff: draft.dropoff, hireQuantity: draft.hireQuantity, firm }, pricing.data)
        result[type] = { fare: quote.fare, distanceKm: quote.distanceKm, rate: type === "hourly" ? firm.hourlyRate : type === "daily" ? firm.dailyRate : undefined }
      } catch (error) {
        result[type] = { error: draft.pickup === draft.dropoff && type !== "hourly" && type !== "daily" ? t("rider.book.samePlace") : errorText(error, t("rider.book.unavailable")) }
      }
    }
    return result
  }, [pricing.data, firms.data, company, draft.pickup, draft.dropoff, draft.hireQuantity, t])

  function go(next: Screen) {
    setCancelling(false)
    setScreen(next)
  }

  function openTrip(trip: Trip) {
    setTripId(trip.id)
    go(screenFor(trip))
  }

  /** Mock demo: assign a free driver and accept for them, as Part 1 did before Dispatch and the driver app. */
  async function autoDispatch(trip: Trip) {
    await wait(SEARCH_MS)
    if ((await api.getTrip(trip.id))?.status !== "requested") return true
    const [drivers, cars] = await Promise.all([api.getDrivers(), api.getCars()])
    const free = drivers.filter((driver) => driver.firmId === trip.firmId && driver.approval === "approved" && driver.status === "online" && cars.some((car) => car.id === driver.carId && car.availability === "available"))
    const driver = free.find((item) => item.zone === trip.pickup) ?? free[0]
    if (!driver) {
      await api.markNoDriverFound(trip.id)
      return false
    }
    await api.assignDriver(trip.id, driver.id)
    const offer = (await api.getOffers(driver.id)).find((item) => item.tripId === trip.id && item.status === "pending")
    if (offer) await api.respondOffer(offer.id, true)
    return true
  }

  async function bookRide() {
    if (!online) return toast(t("common.offlineBook"))
    if (draft.pickup === draft.dropoff && draft.type !== "hourly" && draft.type !== "daily") return toast(t("rider.book.samePlace"))
    if (draft.schedule && !draft.scheduledFor) return toast(t("rider.book.pickTime"))
    if (draft.schedule && Date.parse(draft.scheduledFor) <= Date.now()) return toast(t("rider.book.pastTime"))
    if (!rider) return
    setBusy(true)
    try {
      const created = await api.createBooking({
        riderId: rider.id,
        pickup: draft.pickup,
        dropoff: draft.dropoff,
        type: draft.type,
        paymentMethod: draft.type === "shared_commute" ? "company_account" : draft.payment,
        hireQuantity: draft.type === "hourly" || draft.type === "daily" ? draft.hireQuantity : undefined,
        scheduledFor: draft.schedule ? new Date(draft.scheduledFor).toISOString() : undefined,
      })
      setTripId(created.id)
      if (draft.schedule) {
        go("detail")
        toast(t("rider.book.scheduled"))
        return
      }
      go("finding")
      setBusy(false)
      if (autoAssign) await autoDispatch(created)
    } catch (error) {
      go("book")
      toast(errorText(error, t("rider.book.failed")))
    } finally {
      setBusy(false)
    }
  }

  async function run(action: () => Promise<unknown>, after?: () => void, failText = t("rider.trip.updateFailed")) {
    setBusy(true)
    try {
      await action()
      after?.()
    } catch (error) {
      toast(errorText(error, failText))
    } finally {
      setBusy(false)
    }
  }

  async function signIn(input: { phone: string; name: string; consent: boolean; joinCode?: string }) {
    setBusy(true)
    try {
      const signedIn = await api.signInRider({ phone: input.phone, name: input.name || undefined, consent: input.consent, joinCode: input.joinCode })
      setRiderId(signedIn.id)
      setLanguage(signedIn.language)
      go("home")
      toast(t("rider.signin.welcome"))
    } catch (error) {
      toast(errorText(error, t("rider.signin.failed")))
    } finally {
      setBusy(false)
    }
  }

  function cancelCurrent(reason: string) {
    if (!current) return
    void run(
      () => api.cancelTrip(current.trip.id, "rider", reason),
      () => {
        go("detail")
        toast(t("rider.cancel.done"))
      },
    )
  }

  function changeLanguage(language: Language) {
    if (!rider) return
    setLanguage(language)
    void run(() => api.updateRider(rider.id, { language }))
  }

  const back = backTo[shown] ?? "home"
  const needsTrip = ["finding", "trip", "complete", "receipt", "detail"].includes(shown)

  return (
    <main className="min-h-screen bg-secondary/45 pb-24 text-foreground md:pb-8">
      <div className="mx-auto min-h-screen w-full max-w-[430px] border-x bg-background shadow-sm">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-background/95 px-5 backdrop-blur">
          <Link href="/" aria-label={t("common.homeLink")}>
            <Logo small />
          </Link>
          {shown !== "home" ? (
            <button onClick={() => go(back)} className="grid size-11 place-items-center rounded-full hover:bg-secondary" aria-label={t("common.back")}>
              <ArrowLeft className="size-5" />
            </button>
          ) : (
            <button onClick={() => go("account")} className="grid size-11 place-items-center rounded-full bg-secondary" aria-label={t("rider.nav.account")}>
              <span className="text-sm font-bold">{rider ? initials(rider.name) : ""}</span>
            </button>
          )}
        </header>
        {!online && (
          <div role="status" className="flex items-center gap-2 bg-destructive/10 px-5 py-2 text-sm text-destructive">
            <WifiOff className="size-4 shrink-0" /> {t("common.offline")}
          </div>
        )}

        {!rider && shown !== "signin" ? (
          riderData.data === undefined && !riderData.loading ? (
            <SignInScreen busy={busy} onSubmit={(input) => void signIn(input)} toast={toast} />
          ) : (
            <div className="flex flex-col gap-3 px-5 pt-6" aria-busy>
              <Skeleton className="h-10 w-2/3" />
              <Skeleton className="h-16" />
              <Skeleton className="h-48" />
            </div>
          )
        ) : needsTrip && !current ? (
          <div className="flex flex-col gap-3 px-5 pt-6" aria-busy>
            <Skeleton className="h-48" />
            <Skeleton className="h-32" />
          </div>
        ) : (
          <>
            {shown === "home" && rider && (
              <HomeScreen
                rider={rider}
                recentTrips={trips.data}
                activeTrip={bannerTrip}
                onBook={() => go("book")}
                onSavedPlace={(placeId) => {
                  setDraft({ dropoff: placeId })
                  go("book")
                }}
                onOpenTrip={openTrip}
                onOpenActive={() => bannerTrip && openTrip(bannerTrip)}
                onSeeAll={() => go("trips")}
                onAddPlace={() => go("places")}
              />
            )}
            {shown === "book" && <BookScreen draft={draft} setDraft={setDraft} quotes={quotes} company={company} routeName={route?.name} offline={!online} busy={busy} onConfirm={() => void bookRide()} />}
            {shown === "finding" && current && <FindingScreen trip={current.trip} onCancel={() => setCancelling(true)} onEdit={() => go("book")} onHome={() => go("home")} />}
            {shown === "trip" && current && (
              <TripScreen
                assignment={current}
                busy={busy}
                onArrived={() => void run(() => api.driverArrived(current.trip.id))}
                onStart={() => void run(() => api.startTrip(current.trip.id))}
                onEnd={() => void run(() => api.endTrip(current.trip.id), () => go("complete"))}
                onCancel={() => setCancelling(true)}
                onSos={() =>
                  run(
                    () => api.reportIncident({ type: "safety", tripId: current.trip.id, reportedBy: "rider", description: t("rider.sos.incident") }),
                    () => toast(t("rider.sos.notified")),
                    t("rider.sos.failed"),
                  )
                }
                toast={toast}
              />
            )}
            {shown === "complete" && current && rider && (
              <CompleteScreen
                assignment={current}
                rider={rider}
                company={company}
                busy={busy}
                onPaid={() => run(() => api.riderMarkPaid(current.trip.id), () => toast(t("rider.complete.paymentNoted")), t("rider.complete.payFailed"))}
                onRate={(rating, tags, comment) =>
                  run(
                    () => api.rateTrip(current.trip.id, rating, tags, comment),
                    () => {
                      go("receipt")
                      toast(t("rider.rate.thanks"))
                    },
                  )
                }
                onSkip={() => go("receipt")}
                toast={toast}
              />
            )}
            {shown === "receipt" && current && <ReceiptScreen assignment={current} onDone={() => go("home")} toast={toast} />}
            {shown === "detail" && current && <TripDetailScreen assignment={current} companyName={company?.name} onLive={() => go(screenFor(current.trip))} onReceipt={() => go("receipt")} onPay={() => go("complete")} onCancel={() => setCancelling(true)} />}
            {shown === "trips" && <TripsScreen trips={trips.data} onOpen={openTrip} onBook={() => go("book")} />}
            {shown === "account" && rider && (
              <AccountScreen
                rider={rider}
                company={company}
                onEdit={() => go("signin")}
                onPlaces={() => go("places")}
                onContacts={() => go("contacts")}
                onLanguage={changeLanguage}
                onSignOut={() => {
                  setRiderId(demoRiderId)
                  go("signin")
                }}
                toast={toast}
              />
            )}
            {shown === "places" && rider && <SavedPlacesScreen rider={rider} busy={busy} onSave={(savedPlaces) => run(() => api.updateRider(rider.id, { savedPlaces }), () => toast(t("common.saved")))} />}
            {shown === "contacts" && rider && <EmergencyContactsScreen rider={rider} busy={busy} onSave={(emergencyContacts) => run(() => api.updateRider(rider.id, { emergencyContacts }), () => toast(t("common.saved")))} toast={toast} />}
            {shown === "signin" && <SignInScreen busy={busy} onSubmit={(input) => void signIn(input)} toast={toast} />}
          </>
        )}

        {cancelling && current && <CancelSheet busy={busy} onConfirm={cancelCurrent} onClose={() => setCancelling(false)} />}

        {shown !== "signin" && (
          <nav className="fixed bottom-0 left-1/2 z-20 flex w-full max-w-[430px] -translate-x-1/2 items-center justify-around border-t bg-background/95 px-3 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 backdrop-blur md:bottom-3 md:rounded-2xl md:border">
            <button onClick={() => go("home")} className={`flex min-h-12 min-w-16 flex-col items-center justify-center gap-1 text-[10px] ${shown === "home" || shown === "book" ? "text-primary" : "text-muted-foreground"}`}>
              <Home className="size-5" />
              {t("rider.nav.home")}
            </button>
            <button onClick={() => go("trips")} className={`flex min-h-12 min-w-16 flex-col items-center justify-center gap-1 text-[10px] ${shown === "trips" || shown === "detail" ? "text-primary" : "text-muted-foreground"}`}>
              <Clock3 className="size-5" />
              {t("rider.nav.trips")}
            </button>
            <button onClick={() => go("account")} className={`flex min-h-12 min-w-16 flex-col items-center justify-center gap-1 text-[10px] ${["account", "places", "contacts"].includes(shown) ? "text-primary" : "text-muted-foreground"}`}>
              <UserRound className="size-5" />
              {t("rider.nav.account")}
            </button>
          </nav>
        )}
        {message && <Toast message={message} onClose={clear} />}
      </div>
    </main>
  )
}
