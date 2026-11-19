"use client"

import { useEffect, useEffectEvent, useState } from "react"
import { subscribe, type Topic } from "./api"

/**
 * Load data on the client through lib/api.ts and reload it whenever one of the topics
 * changes (in this tab or another). deps restart the load (for example a new trip id).
 */
export function useLive<T>(load: () => Promise<T>, topics: Topic[], deps: unknown[] = []) {
  const key = JSON.stringify(deps)
  const [state, setState] = useState<{ key: string; data?: T; error?: Error }>({ key: "" })
  const runLoad = useEffectEvent(() => load())
  const topicKey = topics.join(",")

  useEffect(() => {
    let alive = true
    const fetchNow = () => {
      runLoad().then(
        (data) => alive && setState({ key, data }),
        (caught: unknown) => alive && setState((current) => ({ ...current, key, error: caught instanceof Error ? caught : new Error(String(caught)) })),
      )
    }
    fetchNow()
    const stop = subscribe(topicKey.split(",") as Topic[], fetchNow)
    return () => {
      alive = false
      stop()
    }
  }, [key, topicKey])

  const fresh = state.key === key
  return { data: fresh ? state.data : undefined, error: fresh ? state.error : undefined, loading: !fresh }
}

/** True when the browser reports no network connection. */
export function useOnline() {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine))
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener("online", update)
    window.addEventListener("offline", update)
    return () => {
      window.removeEventListener("online", update)
      window.removeEventListener("offline", update)
    }
  }, [])
  return online
}
