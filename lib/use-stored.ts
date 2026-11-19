"use client"

import { useCallback, useSyncExternalStore } from "react"

// A small per-browser setting kept in localStorage (theme, language, signed-in demo rider).
// Reads safely when storage is blocked and updates every component and tab that uses the key.

const EVENT = "flyt-stored-change"

function read(key: string) {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeStored(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Storage blocked: the value is lost on reload.
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: key }))
}

const acceptAny = (value: string): boolean => typeof value === "string"

export function useStored<T extends string>(key: string, fallback: T, isValid: (value: string) => value is T = acceptAny as unknown as (value: string) => value is T) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const handler = (event: Event) => {
        if (event instanceof StorageEvent ? event.key === key : (event as CustomEvent<string>).detail === key) onChange()
      }
      window.addEventListener("storage", handler)
      window.addEventListener(EVENT, handler)
      return () => {
        window.removeEventListener("storage", handler)
        window.removeEventListener(EVENT, handler)
      }
    },
    [key],
  )
  const value = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null,
  )
  const current = value != null && isValid(value) ? value : fallback
  const set = useCallback((next: T) => writeStored(key, next), [key])
  return [current, set] as const
}
