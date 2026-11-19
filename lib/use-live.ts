"use client"

import { useEffect, useEffectEvent, useState, useSyncExternalStore } from "react"
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

function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange)
  window.addEventListener("offline", onChange)
  return () => {
    window.removeEventListener("online", onChange)
    window.removeEventListener("offline", onChange)
  }
}

/** True unless the browser reports no network connection. The server render always assumes online. */
export function useOnline() {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  )
}
