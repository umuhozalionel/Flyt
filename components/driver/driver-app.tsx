"use client"

import { FileText, Home, UserRound, Wallet, WifiOff } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { Logo } from "@/components/shared/logo"
import { MapSheet } from "@/components/shared/map-sheet"
import { MapView } from "@/components/shared/map-view"
import { NotificationBell } from "@/components/shared/notification-center"
import { Skeleton } from "@/components/shared/skeleton"
import { Toast, useToastMessage } from "@/components/shared/toast"
import * as api from "@/lib/api"
import { driverEarnings } from "@/lib/driver"
import { useT } from "@/lib/i18n"
import { carPosition, placeLngLat } from "@/lib/map"
import type { Trip } from "@/lib/types"
import { useLive, useOnline } from "@/lib/use-live"
import { useNow } from "@/lib/use-now"
import { useStored } from "@/lib/use-stored"
import { AfterTripScreen } from "./after-screen"
import { DocumentsScreen } from "./documents-screen"
import { EarningsScreen } from "./earnings-screen"
import { DriverHome, PresenceButton } from "./home-screen"
import { OfferScreen } from "./offer-screen"
import { DriverProfileScreen } from "./profile-screen"
import { DriverSignIn } from "./sign-in-screen"
import { DriverTripScreen } from "./trip-screen"

type Tab = "home" | "earnings" | "documents" | "profile"
const DRIVER_KEY = "flyt-driver-id"
const liveStatuses = ["driver_arriving", "driver_arrived", "in_progress"]

function errorText(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

export default function DriverApp() {
  const t = useT()
  const online = useOnline()
  const now = useNow(1000)
  const { message, toast, clear } = useToastMessage()
  const [driverId, setDriverId] = useStored<string>(DRIVER_KEY, "")
  const [tab, setTab] = useState<Tab>("home")
  const [afterTripId, setAfterTripId] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [sheetHeight, setSheetHeight] = useState(0)

  const me = useLive(() => (driverId ? api.getDrivers().then((rows) => rows.find((row) => row.id === driverId)) : Promise.resolve(undefined)), ["drivers"], [driverId])
  const trips = useLive(() => (driverId ? api.getDriverTrips(driverId) : Promise.resolve([])), ["trips"], [driverId])
  const offers = useLive(() => (driverId ? api.getOffers(driverId) : Promise.resolve([])), ["offers", "trips"], [driverId])
  const firms = useLive(api.getFirms, ["firms"])
  const cars = useLive(api.getCars, ["cars"])

  const driver = me.data
  const firm = firms.data?.find((item) => item.id === driver?.firmId)
  const car = cars.data?.find((item) => item.id === driver?.carId)
  const offer = offers.data?.find((item) => item.status === "pending")
  const secondsLeft = offer ? Math.max(0, Math.ceil((Date.parse(offer.expiresAt) - now) / 1000)) : 0
  const liveTrip = trips.data?.find((trip) => liveStatuses.includes(trip.status))
  const focusId = offer && secondsLeft > 0 ? offer.tripId : liveTrip?.id ?? afterTripId
  const job = useLive(() => (focusId && driverId ? api.getDriverJob(focusId, driverId) : Promise.resolve(undefined)), ["trips", "riders"], [focusId, driverId])
  const current = job.data?.trip.id === focusId ? job.data : undefined

  // When the 20 seconds run out, a read expires the offer and sends the trip back to Dispatch.
  const offerOverdue = !!offer && secondsLeft <= 0
  useEffect(() => {
    if (offerOverdue && driverId) void api.getOffers(driverId)
  }, [offerOverdue, driverId])

  async function run(action: () => Promise<unknown>, done?: () => void, failText = t("driver.failed")) {
    setBusy(true)
    try {
      await action()
      done?.()
      return true
    } catch (error) {
      toast(errorText(error, failText))
      return false
    } finally {
      setBusy(false)
    }
  }

  async function signIn(phone: string, code: string) {
    await run(async () => {
      const signedIn = await api.signInDriver({ phone, code })
      setDriverId(signedIn.id)
      setTab("home")
    })
  }

  const earnings = driverEarnings(trips.data ?? [], driverId)
  const toConfirm = (trips.data ?? []).filter((trip) => trip.status === "completed" && trip.paymentMethod !== "company_account" && trip.paymentStatus === "pending")
  const openTrip = (trip: Trip) => setAfterTripId(trip.id)

  const signedOut = !driverId || (me.data === undefined && !me.loading)
  const showOffer = !!offer && secondsLeft > 0 && current && current.trip.id === offer.tripId && driver
  const showTrip = !showOffer && liveTrip && current?.trip.id === liveTrip.id
  const showAfter = !showOffer && !showTrip && afterTripId && current?.trip.id === afterTripId

  return (
    <main className={`min-h-screen bg-secondary/45 text-foreground ${tab === "home" && !showTrip && !showAfter ? "" : "pb-24"}`}>
      <div className="mx-auto min-h-screen w-full max-w-[430px] border-x bg-background shadow-sm">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-background/95 px-5 backdrop-blur">
          <Link href="/" aria-label={t("common.homeLink")}>
            <Logo small />
          </Link>
          <span className="flex items-center gap-1">
            {driverId && driver && <NotificationBell viewer={{ kind: "driver", id: driverId }} />}
            <span className="text-sm font-semibold text-muted-foreground">{t("driver.appName")}</span>
          </span>
        </header>
        {!online && (
          <div role="status" className="flex items-center gap-2 bg-destructive/10 px-5 py-2 text-sm text-destructive">
            <WifiOff className="size-4 shrink-0" /> {t("driver.offline")}
          </div>
        )}

        {signedOut ? (
          <DriverSignIn busy={busy} onSubmit={(phone, code) => void signIn(phone, code)} toast={toast} />
        ) : !driver ? (
          <div className="flex flex-col gap-3 px-5 pt-6" aria-busy>
            <Skeleton className="h-24" />
            <Skeleton className="h-32" />
          </div>
        ) : showTrip ? (
          <DriverTripScreen
            job={current!}
            busy={busy}
            onArrived={() => void run(() => api.driverArrived(liveTrip!.id))}
            onStart={(pin) => void run(() => api.startTrip(liveTrip!.id, pin))}
            toast={toast}
            onEnd={() => void run(() => api.endTrip(liveTrip!.id), () => setAfterTripId(liveTrip!.id))}
            onSos={() =>
              run(
                () => api.reportIncident({ type: "safety", tripId: liveTrip!.id, reportedBy: "driver", description: t("driver.sos.incident") }),
                () => toast(t("rider.sos.notified")),
              ).then(() => undefined)
            }
          />
        ) : showAfter ? (
          <AfterTripScreen
            job={current!}
            busy={busy}
            onConfirm={(received) => void run(() => api.confirmPayment(afterTripId!, received), () => toast(received ? t("driver.after.confirmedToast") : t("driver.after.notReceivedToast")))}
            onRate={(rating) => void run(() => api.rateRider(afterTripId!, rating), () => toast(t("driver.after.ratedToast")))}
            onDone={() => {
              setAfterTripId(undefined)
              setTab("home")
            }}
          />
        ) : (
          <>
            {tab === "home" && (
              // Map first: the driver's car on the map, a big Go online button over it, and the day in a sheet.
              <div className="relative h-[calc(100dvh-8.75rem)] overflow-hidden">
                <MapView full cars={[{ key: driver.id, position: carPosition(driver.id, driver.zone, Math.floor(now / 3000) * 3000), state: driver.status === "on_trip" ? "on_trip" : "free" }]} center={placeLngLat(driver.zone)} padding={{ bottom: sheetHeight, top: 96 }} label={t("driver.map.label")} />
                <div className="absolute inset-x-3 top-3 z-[5]">
                  <PresenceButton driver={driver} busy={busy} onToggle={(next) => void run(() => api.setDriverPresence(driver.id, next ? "online" : "offline"), () => toast(next ? t("driver.home.nowOnline") : t("driver.home.nowOffline")))} />
                </div>
                <MapSheet label={t("driver.nav.home")} maxShare={0.6} onHeight={setSheetHeight}>
                  <DriverHome driver={driver} firm={firm} earnings={earnings} toConfirm={toConfirm} onDocuments={() => setTab("documents")} onOpenTrip={openTrip} />
                </MapSheet>
              </div>
            )}
            {tab === "earnings" && <EarningsScreen earnings={earnings} trips={trips.data ?? []} onOpen={openTrip} />}
            {tab === "documents" && <DocumentsScreen driver={driver} car={car} busy={busy} onSubmit={(type, expiry, file) => run(() => api.submitDocument(driver.id, type, expiry, file), () => toast(t("driver.docs.sent")))} />}
            {tab === "profile" && (
              <DriverProfileScreen
                driver={driver}
                car={car}
                firm={firm}
                toast={toast}
                onSignOut={() =>
                  void run(async () => {
                    if (driver.status === "online") await api.setDriverPresence(driver.id, "offline")
                    setDriverId("")
                    await api.signOut()
                  })
                }
              />
            )}
          </>
        )}

        {showOffer && current && <OfferScreen job={current} driver={driver} secondsLeft={secondsLeft} busy={busy} onAccept={() => void run(() => api.respondOffer(offer.id, true), () => toast(t("driver.offer.accepted")))} onDecline={() => void run(() => api.respondOffer(offer.id, false), () => toast(t("driver.offer.declined")))} />}

        {!signedOut && driver && !showTrip && !showAfter && (
          <nav className="fixed bottom-0 left-1/2 z-20 flex w-full max-w-[430px] -translate-x-1/2 items-center justify-around border-t bg-background/95 px-3 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 backdrop-blur" aria-label={t("driver.nav.label")}>
            {(
              [
                ["home", Home, "driver.nav.home"],
                ["earnings", Wallet, "driver.nav.earnings"],
                ["documents", FileText, "driver.nav.documents"],
                ["profile", UserRound, "driver.nav.profile"],
              ] as const
            ).map(([id, Icon, label]) => (
              <button key={id} onClick={() => setTab(id)} aria-current={tab === id ? "page" : undefined} className={`flex min-h-14 min-w-16 flex-col items-center justify-center gap-1 text-xs ${tab === id ? "text-primary" : "text-muted-foreground"}`}>
                <Icon className="size-6" />
                {t(label)}
              </button>
            ))}
          </nav>
        )}
        {message && <Toast message={message} onClose={clear} />}
      </div>
    </main>
  )
}
