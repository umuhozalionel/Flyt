"use client"

import { useEffect, useState } from "react"

/** The current time in ms, refreshed every `everyMs`, for countdowns and ETAs. */
export function useNow(everyMs = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), everyMs)
    return () => window.clearInterval(timer)
  }, [everyMs])
  return now
}
