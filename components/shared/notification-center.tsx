"use client"

import { Bell, BellOff, BellRing, Check } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Dialog } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import * as api from "@/lib/api"
import { notificationTypesFor } from "@/lib/additions"
import { formatDate } from "@/lib/format"
import { useT, type TranslationKey } from "@/lib/i18n"
import { enableBrowserNotifications, notificationPermission, registerServiceWorker, showBrowserNotification } from "@/lib/push"
import type { AppNotification, NotificationType, Viewer } from "@/lib/types"
import { useLive } from "@/lib/use-live"

/** Where a notification opens, by who gets it. */
function linkFor(viewer: Viewer, item: AppNotification) {
  if (viewer.kind === "rider") return "/rider"
  if (viewer.kind === "driver") return "/driver"
  if (item.type === "invoice_sent") return "/ops/invoices"
  if (item.tripId) return `/ops/trips?id=${item.tripId}`
  return "/ops"
}

/**
 * The bell and the notification centre: a list of this person's notifications, mark as read, and settings to mute
 * types and turn on browser notifications. New notifications also show as browser notifications (when allowed),
 * and a new driver offer plays a sound and vibrates where the phone supports it.
 */
export function NotificationBell({ viewer, portalLink, className = "" }: { viewer: Viewer; portalLink?: string; className?: string }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [settings, setSettings] = useState(false)
  const key = `${viewer.kind}:${viewer.id}`
  const list = useLive(() => (viewer.id ? api.getNotifications(viewer) : Promise.resolve([])), ["notifications", "trips", "offers", "drivers", "invoices", "incidents", "chat"], [key])
  const items = list.data ?? []
  const unread = items.filter((item) => !item.readAt)

  // Announce notifications that arrive while this page is open (not the ones already there when it loaded).
  const seen = useRef<Set<string> | undefined>(undefined)
  useEffect(() => {
    if (!list.data) return
    if (!seen.current) {
      seen.current = new Set(list.data.map((item) => item.id))
      void registerServiceWorker()
      return
    }
    for (const item of list.data) {
      if (seen.current.has(item.id)) continue
      seen.current.add(item.id)
      if (item.readAt) continue
      // The offer sound and vibration play on the offer screen itself (components/driver/offer-screen.tsx).
      const title = t(`notify.type.${item.type}` as TranslationKey)
      if (document.visibilityState === "hidden" || item.type === "offer_new") void showBrowserNotification(item, title, portalLink ?? linkFor(viewer, item))
    }
  }, [list.data, t, viewer, portalLink])
  useEffect(() => {
    seen.current = undefined
  }, [key])

  return (
    <>
      <button onClick={() => setOpen(true)} className={`relative grid size-11 place-items-center rounded-full hover:bg-secondary ${className}`} aria-label={unread.length ? t("notify.bellUnread", { count: unread.length }) : t("notify.bell")}>
        <Bell className="size-5" />
        {unread.length > 0 && <span className="absolute right-1.5 top-1.5 grid min-w-5 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-5 text-white">{unread.length > 9 ? "9+" : unread.length}</span>}
      </button>
      {open && (
        <Dialog title={settings ? t("notify.settings") : t("notify.title")} onClose={() => (settings ? setSettings(false) : setOpen(false))} closeLabel={t("common.close")}>
          {settings ? (
            <NotificationSettings viewer={viewer} />
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" className="min-h-10" disabled={!unread.length} onClick={() => void api.markNotificationsRead(viewer)}>
                  <Check className="size-4" /> {t("notify.markAll")}
                </Button>
                <Button variant="ghost" className="ml-auto min-h-10" onClick={() => setSettings(true)}>
                  {t("notify.settings")}
                </Button>
              </div>
              {items.length ? (
                <ul className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto">
                  {items.map((item) => (
                    <li key={item.id}>
                      <button
                        className={`w-full rounded-2xl border p-3 text-left ${item.readAt ? "bg-card" : "border-primary/40 bg-primary/5"}`}
                        onClick={() => {
                          if (!item.readAt) void api.markNotificationsRead(viewer, [item.id])
                        }}
                      >
                        <span className="flex items-center gap-2">
                          {!item.readAt && <span className="size-2 shrink-0 rounded-full bg-primary" aria-label={t("notify.unread")} />}
                          <span className="font-semibold">{t(`notify.type.${item.type}` as TranslationKey)}</span>
                          <span className="ml-auto shrink-0 text-xs text-muted-foreground">{formatDate(item.createdAt)}</span>
                        </span>
                        <span className="mt-1 block text-sm text-muted-foreground">{item.body}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="flex flex-col items-center gap-2 rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  <BellOff className="size-6" /> {t("notify.empty")}
                </p>
              )}
            </div>
          )}
        </Dialog>
      )}
    </>
  )
}

function NotificationSettings({ viewer }: { viewer: Viewer }) {
  const t = useT()
  const mutes = useLive(() => api.getNotificationMutes(viewer), ["notifications"], [viewer.kind, viewer.id])
  const [permission, setPermission] = useState(notificationPermission)
  const [busy, setBusy] = useState(false)
  const muted = new Set<NotificationType>(mutes.data ?? [])
  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-2xl border bg-card p-4">
        <p className="flex items-center gap-2 font-semibold">
          <BellRing className="size-4 text-primary" /> {t("notify.browser")}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{t(`notify.permission.${permission}` as TranslationKey)}</p>
        {permission === "default" && (
          <Button
            className="mt-3 min-h-11 w-full"
            disabled={busy}
            onClick={() => {
              setBusy(true)
              void enableBrowserNotifications(viewer)
                .then(setPermission)
                .finally(() => setBusy(false))
            }}
          >
            {t("notify.enable")}
          </Button>
        )}
      </section>
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-2 text-sm font-semibold">{t("notify.muteTitle")}</legend>
        {notificationTypesFor[viewer.kind].map((type) => (
          <label key={type} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-2 hover:bg-secondary">
            <input type="checkbox" className="size-5 accent-[var(--primary)]" checked={!muted.has(type)} onChange={(event) => void api.setNotificationMute(viewer, type, !event.target.checked)} />
            <span className="text-sm">{t(`notify.type.${type}` as TranslationKey)}</span>
          </label>
        ))}
      </fieldset>
      <p className="text-xs text-muted-foreground">{t("notify.muteNote")}</p>
    </div>
  )
}
