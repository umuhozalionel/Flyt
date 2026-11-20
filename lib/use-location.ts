"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { inKigali, type LngLat } from "./map"

export type LocationState = "idle" | "asking" | "on" | "denied" | "outside" | "unavailable"

/**
 * The person's position, only after they tap to share it (the browser asks once; we never ask on page load).
 * If they shared it before, it starts again quietly. If they refuse, or are outside Kigali, the map stays on Kigali.
 */
export function useLocation() {
  const [state, setState] = useState<LocationState>("idle")
  const [position, setPosition] = useState<LngLat | null>(null)
  const watch = useRef<number | undefined>(undefined)

  const start = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return setState("unavailable")
    if (watch.current !== undefined) return
    setState((current) => (current === "on" ? current : "asking"))
    watch.current = navigator.geolocation.watchPosition(
      (found) => {
        const here: LngLat = [found.coords.longitude, found.coords.latitude]
        if (!inKigali(here)) {
          setPosition(null)
          setState("outside")
          return
        }
        setPosition(here)
        setState("on")
      },
      (error) => {
        if (watch.current !== undefined) navigator.geolocation.clearWatch(watch.current)
        watch.current = undefined
        setPosition(null)
        setState(error.code === error.PERMISSION_DENIED ? "denied" : "unavailable")
      },
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 15_000 },
    )
  }, [])

  useEffect(() => {
    let alive = true
    // Shared before: start without asking again.
    void navigator.permissions
      ?.query({ name: "geolocation" })
      .then((status) => {
        if (!alive) return
        if (status.state === "granted") start()
        else if (status.state === "denied") setState("denied")
      })
      .catch(() => undefined)
    return () => {
      alive = false
      if (watch.current !== undefined) navigator.geolocation?.clearWatch(watch.current)
      watch.current = undefined
    }
  }, [start])

  return { state, position, request: start }
}
