/* Flyt service worker: one worker for notifications and for working offline.
 * - Browser notifications: shows pushes (Web Push with VAPID keys, free) and notifications the open app asks for.
 * - Offline: pages are fetched from the network first; without a connection the last copy or the offline page is shown.
 *   Built files (/_next/static) are cached once. Data (Supabase, map tiles) is never cached here.
 */
const VERSION = "flyt-v2"
const SHELL = ["/offline.html", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/maskable-512.png", "/icons/badge-72.png"]

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener("fetch", (event) => {
  const request = event.request
  if (request.method !== "GET") return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname.startsWith("/fonts/")) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone()
              caches.open(VERSION).then((cache) => cache.put(request, copy))
            }
            return response
          }),
      ),
    )
    return
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(VERSION).then((cache) => cache.put(request, copy))
          }
          return response
        })
        .catch(() => caches.match(request).then((hit) => hit || caches.match("/offline.html"))),
    )
  }
})

// ── Notifications ────────────────────────────────────────────────────────────────────────

self.addEventListener("push", (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: "Flyt", body: event.data ? event.data.text() : "" }
  }
  const options = {
    body: data.body || "",
    tag: data.tag || undefined,
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-72.png",
    data: { link: data.link || "/" },
  }
  if (data.type === "offer_new") {
    options.vibrate = [200, 100, 200]
    options.requireInteraction = true
  }
  event.waitUntil(self.registration.showNotification(data.title || "Flyt", options))
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const link = (event.notification.data && event.notification.data.link) || "/"
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (new URL(client.url).pathname === new URL(link, self.location.origin).pathname && "focus" in client) return client.focus()
      }
      return self.clients.openWindow(link)
    }),
  )
})
