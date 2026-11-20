"use client"

import * as api from "./api"
import { dataSource, vapidPublicKey } from "./config"
import type { AppNotification, Viewer } from "./types"

// Browser notifications through the one service worker (public/sw.js). Free: Web Push with VAPID keys.
// While Flyt is open (or in a background tab) new notifications are shown by the service worker.
// With Supabase and a VAPID key set, the browser also gets pushes when Flyt is closed (sent by
// supabase/functions/push). Phone push through app stores is not part of this (not approved).

export const pushSupported = () => typeof window !== "undefined" && "serviceWorker" in navigator && "Notification" in window

export async function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return undefined
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" })
  } catch {
    return undefined
  }
}

export const notificationPermission = (): NotificationPermission | "unsupported" => (pushSupported() ? Notification.permission : "unsupported")

function base64ToBytes(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(padded)
  return Uint8Array.from(raw, (char) => char.charCodeAt(0))
}

/** Ask once (from a tap), then subscribe this browser for pushes when a VAPID key is set. */
export async function enableBrowserNotifications(viewer: Viewer): Promise<NotificationPermission | "unsupported"> {
  if (!pushSupported()) return "unsupported"
  const permission = await Notification.requestPermission()
  if (permission !== "granted") return permission
  const registration = await registerServiceWorker()
  if (registration && vapidPublicKey && dataSource === "supabase" && "pushManager" in registration) {
    try {
      const subscription = (await registration.pushManager.getSubscription()) ?? (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToBytes(vapidPublicKey) }))
      const json = subscription.toJSON()
      if (json.endpoint && json.keys?.p256dh && json.keys.auth) await api.savePushSubscription(viewer, { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth })
    } catch {
      // Push is optional: in-app and open-tab notifications still work.
    }
  }
  return permission
}

/** Show a notification through the service worker (falls back to the page Notification API). */
export async function showBrowserNotification(item: AppNotification, title: string, link: string) {
  if (notificationPermission() !== "granted") return
  const options: NotificationOptions & { vibrate?: number[] } = { body: item.body, tag: item.id, icon: "/icons/icon-192.png", badge: "/icons/badge-72.png", data: { link } }
  if (item.type === "offer_new") options.vibrate = [200, 100, 200]
  const registration = await navigator.serviceWorker?.getRegistration()
  if (registration) await registration.showNotification(title, options)
  else new Notification(title, options)
}

// ── Sound and vibration for driver offers ────────────────────────────────────────────────
let audio: AudioContext | undefined

/** A short two-tone chime made in the browser (no sound file to load). */
export function playOfferSound() {
  if (typeof window === "undefined") return
  try {
    const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Context) return
    audio ??= new Context()
    const start = audio.currentTime
    for (const [index, frequency] of [880, 1175].entries()) {
      const oscillator = audio.createOscillator()
      const gain = audio.createGain()
      oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(0.0001, start + index * 0.18)
      gain.gain.exponentialRampToValueAtTime(0.25, start + index * 0.18 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + index * 0.18 + 0.16)
      oscillator.connect(gain).connect(audio.destination)
      oscillator.start(start + index * 0.18)
      oscillator.stop(start + index * 0.18 + 0.17)
    }
  } catch {
    // Some browsers block sound until the page was tapped.
  }
}

/** Vibrate where the phone supports it. */
export function vibrate(pattern: number | number[] = 30) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(pattern)
  } catch {
    // Not supported.
  }
}
