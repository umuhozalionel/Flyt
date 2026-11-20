"use client"

import { CarFront, Clock3, Link2Off, MapPin } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { Logo } from "@/components/shared/logo"
import { MapView } from "@/components/shared/map-view"
import { Skeleton } from "@/components/shared/skeleton"
import { StatusBadge } from "@/components/shared/status-badge"
import * as api from "@/lib/api"
import { formatTime } from "@/lib/format"
import { useT, type TranslationKey } from "@/lib/i18n"
import { placeName } from "@/lib/places"
import type { SharedTripView } from "@/lib/types"

function readToken() {
  if (typeof window === "undefined") return ""
  return window.location.hash.replace(/^#/, "").trim()
}

/**
 * Read-only live view of a shared trip. No sign-in, no phone numbers, no fare. The link stops working
 * when the trip ends or the rider stops sharing.
 */
export function SharedTripPage() {
  const t = useT()
  const [token, setToken] = useState<string>()
  const [state, setState] = useState<{ token?: string; trip?: SharedTripView; done: boolean }>({ done: false })
  useEffect(() => {
    const update = () => setToken(readToken())
    update()
    window.addEventListener("hashchange", update)
    return () => window.removeEventListener("hashchange", update)
  }, [])
  // People who open the link are not signed in, so the page asks again every 15 seconds.
  useEffect(() => {
    if (token === undefined) return
    let alive = true
    const load = () =>
      (token ? api.getSharedTrip(token) : Promise.resolve(undefined)).then(
        (trip) => alive && setState({ token, trip, done: true }),
        () => alive && setState({ token, done: true }),
      )
    void load()
    const timer = window.setInterval(load, 15_000)
    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [token])
  const loading = token === undefined || state.token !== token || !state.done
  const view = { loading }
  const trip = state.token === token ? state.trip : undefined

  return (
    <main className="min-h-screen bg-secondary/45 text-foreground">
      <div className="mx-auto min-h-screen w-full max-w-[430px] border-x bg-background px-5 pb-10 shadow-sm">
        <header className="flex h-16 items-center justify-between">
          <Link href="/" aria-label={t("common.homeLink")}>
            <Logo small />
          </Link>
          <span className="text-xs font-semibold uppercase text-muted-foreground">{t("share.pageTag")}</span>
        </header>
        {!token || (!trip && !view.loading) ? (
          <div className="mt-10 flex flex-col items-center gap-3 rounded-3xl border border-dashed p-8 text-center">
            <Link2Off className="size-8 text-muted-foreground" />
            <h1 className="text-xl font-semibold">{t("share.endedTitle")}</h1>
            <p className="text-sm text-muted-foreground">{t("share.endedDetail")}</p>
          </div>
        ) : !trip ? (
          <div className="mt-4 flex flex-col gap-3" aria-busy>
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="h-56" />
            <Skeleton className="h-24" />
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted-foreground">{t("share.someone")}</p>
            <h1 className="mt-1 flex flex-wrap items-center gap-2 text-2xl font-semibold">
              {placeName(trip.pickup)} → {placeName(trip.dropoff)}
            </h1>
            <div className="mt-2">
              <StatusBadge status={trip.status} />
            </div>
            <div className="mt-4">
              <MapView pickup={trip.pickup} dropoff={trip.dropoff} car={!!trip.car} />
            </div>
            {trip.car && (
              <div className="mt-4 flex items-center gap-3 rounded-2xl border bg-card p-4">
                <CarFront className="size-6 text-primary" />
                <span className="text-sm">
                  <span className="block font-semibold">{t("share.driver", { name: trip.driverFirstName ?? "" })}</span>
                  <span className="text-muted-foreground">
                    {trip.car.colour} {trip.car.make} {trip.car.model} · <span className="font-semibold text-foreground">{trip.car.plate}</span>
                  </span>
                </span>
              </div>
            )}
            <ul className="mt-4 flex flex-col gap-2 rounded-2xl border bg-card p-4 text-sm">
              <li className="flex items-center gap-2">
                <MapPin className="size-4 text-primary" /> {t("share.type", { type: t(`tripType.${trip.type}` as TranslationKey) })}
              </li>
              {trip.status === "driver_arriving" && trip.pickupEtaMinutes != null && (
                <li className="flex items-center gap-2">
                  <Clock3 className="size-4 text-primary" /> {t("share.eta", { min: trip.pickupEtaMinutes })}
                </li>
              )}
              {trip.arrivedAt && <li>{t("share.arrivedAt", { time: formatTime(trip.arrivedAt) })}</li>}
              {trip.startedAt && <li>{t("share.startedAt", { time: formatTime(trip.startedAt) })}</li>}
            </ul>
            <p className="mt-4 text-xs text-muted-foreground">{t("share.privacy")}</p>
          </>
        )}
      </div>
    </main>
  )
}
