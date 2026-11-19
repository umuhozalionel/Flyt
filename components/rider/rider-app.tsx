"use client"

import Link from "next/link"
import { ArrowLeft, Clock3, Home, UserRound } from "lucide-react"
import { useCallback, useMemo, useState } from "react"
import { Logo } from "@/components/shared/logo"
import { Skeleton } from "@/components/shared/skeleton"
import { Toast, useToastMessage } from "@/components/shared/toast"
import * as api from "@/lib/api"
import { demoAutoDispatch, demoRiderId } from "@/lib/config"
import { initials } from "@/lib/format"
import { useT } from "@/lib/i18n"
import { firmsOffering, quoteFare } from "@/lib/pricing"
import { activeStatuses } from "@/lib/trip-rules"
import { useLive } from "@/lib/use-live"
import { useStored } from "@/lib/use-stored"
import type { Trip, TripType } from "@/lib/types"
import { AccountScreen } from "./account-screen"
import { BookScreen, type OptionQuote } from "./book-screen"
import { CompleteScreen } from "./complete-screen"
import { FindingScreen } from "./finding-screen"
import { HomeScreen } from "./home-screen"
import { ReceiptScreen } from "./receipt-screen"
import { SignInScreen } from "./sign-in-screen"
import { TripScreen } from "./trip-screen"
import { TripsScreen } from "./trips-screen"
import type { BookingDraft, Screen } from "./types"

const RIDER_KEY = "flyt-rider-id"
const quoteTypes: TripType[] = ["private", "airport", "hourly", "daily"]

function errorText(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

export default function RiderApp() {
  const t = useT()
  const [screen, setScreen] = useState<Screen>("home")
  const [riderId, setRiderId] = useStored<string>(RIDER_KEY, demoRiderId)
  const [tripId, setTripId] = useState<string>()
  const [busy, setBusy] = useState(false)
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
  const trips = useLive(() => api.getRiderTrips(riderId), ["trips"], [riderId])
  const assignment = useLive(() => (tripId ? api.getTripAssignment(tripId) : Promise.resolve(undefined)), ["trips", "drivers", "cars", "firms"], [tripId])

  const rider = riderData.data
  const company = companies.data?.find((item) => item.id === rider?.companyId)
  const current = assignment.data
  const activeTrip = trips.data?.find((trip) => activeStatuses.includes(trip.status))

  // Price preview for each ride type, from the active plan and the firm that would run it.
  const quotes = useMemo(() => {
    if (!pricing.data || !firms.data) return undefined
    const result: Partial<Record<TripType, OptionQuote>> = {}
    for (const type of quoteTypes) {
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
  }, [pricing.data, firms.data, draft.pickup, draft.dropoff, draft.hireQuantity, t])

  function openTrip(trip: Trip) {
    setTripId(trip.id)
    setScreen(trip.status === "completed" ? "receipt" : "trip")
  }

  /** Mock demo: assign a free driver and accept for them, as Part 1 did before Dispatch and the driver app. */
  async function autoDispatch(trip: Trip) {
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
    if (draft.pickup === draft.dropoff && draft.type !== "hourly" && draft.type !== "daily") return toast(t("rider.book.samePlace"))
    if (draft.schedule && !draft.scheduledFor) return toast(t("rider.book.pickTime"))
    if (!rider) return
    setBusy(true)
    setScreen("finding")
    try {
      const created = await api.createBooking({
        riderId: rider.id,
        pickup: draft.pickup,
        dropoff: draft.dropoff,
        type: draft.type,
        paymentMethod: draft.payment,
        hireQuantity: draft.type === "hourly" || draft.type === "daily" ? draft.hireQuantity : undefined,
        scheduledFor: draft.schedule ? new Date(draft.scheduledFor).toISOString() : undefined,
      })
      setTripId(created.id)
      if (draft.schedule) {
        setScreen("trips")
        toast(t("rider.book.scheduled"))
        return
      }
      if (demoAutoDispatch) {
        const found = await autoDispatch(created)
        setScreen(found ? "trip" : "finding")
      }
    } catch (error) {
      setScreen("book")
      toast(errorText(error, t("rider.book.failed")))
    } finally {
      setBusy(false)
    }
  }

  async function run(action: () => Promise<unknown>, after?: () => void) {
    setBusy(true)
    try {
      await action()
      after?.()
    } catch (error) {
      toast(errorText(error, t("rider.trip.updateFailed")))
    } finally {
      setBusy(false)
    }
  }

  async function signIn(input: { phone: string; name: string; consent: boolean }) {
    setBusy(true)
    try {
      const signedIn = await api.signInRider({ phone: input.phone, name: input.name || undefined, consent: input.consent })
      setRiderId(signedIn.id)
      setScreen("home")
      toast(t("rider.signin.welcome"))
    } catch (error) {
      toast(errorText(error, t("rider.signin.failed")))
    } finally {
      setBusy(false)
    }
  }

  const showBack = screen !== "home"
  const tripReady = current && current.trip.id === tripId

  return (
    <main className="min-h-screen bg-secondary/45 pb-24 text-foreground md:pb-8">
      <div className="mx-auto min-h-screen w-full max-w-[430px] border-x bg-background shadow-sm">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-background/95 px-5 backdrop-blur">
          <Link href="/" aria-label={t("common.homeLink")}>
            <Logo small />
          </Link>
          {showBack ? (
            <button onClick={() => setScreen("home")} className="grid size-11 place-items-center rounded-full hover:bg-secondary" aria-label={t("common.back")}>
              <ArrowLeft className="size-5" />
            </button>
          ) : (
            <button onClick={() => setScreen("account")} className="grid size-11 place-items-center rounded-full bg-secondary" aria-label={t("rider.nav.account")}>
              <span className="text-sm font-bold">{rider ? initials(rider.name) : ""}</span>
            </button>
          )}
        </header>

        {!rider && screen !== "signin" ? (
          <div className="flex flex-col gap-3 px-5 pt-6">
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="h-16" />
            <Skeleton className="h-48" />
          </div>
        ) : (
          <>
            {screen === "home" && rider && (
              <HomeScreen
                rider={rider}
                recentTrips={trips.data}
                activeTrip={activeTrip}
                onBook={() => setScreen("book")}
                onSavedPlace={(placeId) => {
                  setDraft({ dropoff: placeId })
                  setScreen("book")
                }}
                onOpenTrip={openTrip}
                onOpenActive={() => activeTrip && openTrip(activeTrip)}
                onSeeAll={() => setScreen("trips")}
                toast={toast}
              />
            )}
            {screen === "book" && <BookScreen draft={draft} setDraft={setDraft} quotes={quotes} company={company} busy={busy} onConfirm={() => void bookRide()} />}
            {screen === "finding" && (
              <FindingScreen
                trip={tripReady ? current.trip : undefined}
                onCancel={() => {
                  if (tripId) void api.cancelTrip(tripId, "rider", t("rider.finding.cancelReason")).catch(() => undefined)
                  setScreen("home")
                }}
                onEdit={() => setScreen("book")}
                onHome={() => setScreen("home")}
              />
            )}
            {screen === "trip" && tripReady && (
              <TripScreen
                assignment={current}
                busy={busy}
                onArrived={() => void run(() => api.driverArrived(current.trip.id))}
                onStart={() => void run(() => api.startTrip(current.trip.id))}
                onEnd={() => void run(() => api.endTrip(current.trip.id), () => setScreen("complete"))}
                toast={toast}
              />
            )}
            {screen === "complete" && tripReady && rider && (
              <CompleteScreen
                assignment={current}
                rider={rider}
                company={company}
                onPaid={() => run(() => api.riderMarkPaid(current.trip.id), () => toast(t("rider.complete.paymentNoted")))}
                onRate={(rating, tags) =>
                  run(
                    () => api.rateTrip(current.trip.id, rating, tags),
                    () => {
                      setScreen("receipt")
                      toast(t("rider.rate.thanks"))
                    },
                  )
                }
                onSkip={() => setScreen("receipt")}
                toast={toast}
              />
            )}
            {screen === "receipt" && tripReady && <ReceiptScreen assignment={current} onDone={() => setScreen("home")} toast={toast} />}
            {(screen === "trip" || screen === "complete" || screen === "receipt") && !tripReady && (
              <div className="flex flex-col gap-3 px-5 pt-6">
                <Skeleton className="h-48" />
                <Skeleton className="h-32" />
              </div>
            )}
            {screen === "trips" && <TripsScreen trips={trips.data} onOpen={openTrip} onBook={() => setScreen("book")} />}
            {screen === "account" && rider && <AccountScreen rider={rider} company={company} onEdit={() => setScreen("signin")} onSignOut={() => {
                  setRiderId(demoRiderId)
                  setScreen("signin")
                }} toast={toast} />}
            {screen === "signin" && <SignInScreen busy={busy} onSubmit={(input) => void signIn(input)} toast={toast} />}
          </>
        )}

        {screen !== "signin" && (
          <nav className="fixed bottom-0 left-1/2 z-20 flex w-full max-w-[430px] -translate-x-1/2 items-center justify-around border-t bg-background/95 px-3 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 backdrop-blur md:bottom-3 md:rounded-2xl md:border">
            <button onClick={() => setScreen("home")} className={`flex min-h-12 min-w-16 flex-col items-center justify-center gap-1 text-[10px] ${screen === "home" || screen === "book" ? "text-primary" : "text-muted-foreground"}`}>
              <Home className="size-5" />
              {t("rider.nav.home")}
            </button>
            <button onClick={() => setScreen("trips")} className={`flex min-h-12 min-w-16 flex-col items-center justify-center gap-1 text-[10px] ${screen === "trips" ? "text-primary" : "text-muted-foreground"}`}>
              <Clock3 className="size-5" />
              {t("rider.nav.trips")}
            </button>
            <button onClick={() => setScreen("account")} className={`flex min-h-12 min-w-16 flex-col items-center justify-center gap-1 text-[10px] ${screen === "account" ? "text-primary" : "text-muted-foreground"}`}>
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
