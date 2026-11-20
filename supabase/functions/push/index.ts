// Browser push sender (Web Push with VAPID keys, free; no account or paid service).
// Postgres calls this function (through pg_net) when a notification is saved for someone who has a browser
// push subscription. It sends the notification to each of that person's browsers and removes subscriptions
// the browser has dropped. The VAPID private key and the shared secret live only in this function's
// environment (supabase/functions/.env locally, project secrets in the cloud), never in client code.
import { createClient } from "npm:@supabase/supabase-js@2.119.1"
import webpush from "npm:web-push@3.6.7"

const secret = Deno.env.get("PUSH_WEBHOOK_SECRET") ?? ""
const publicKey = Deno.env.get("VAPID_PUBLIC_KEY") ?? ""
const privateKey = Deno.env.get("VAPID_PRIVATE_KEY") ?? ""
const subject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:hello@flyt.rw"

/** Where a tap on the notification opens, by notification type. */
function linkFor(type: string, tripId: string | null) {
  if (["invoice_sent", "incident_opened", "request_waiting"].includes(type)) return tripId ? `/ops/trips?id=${tripId}` : "/ops"
  if (["offer_new", "trip_cancelled_by_rider", "document_expiring_30", "document_expiring_7", "document_approved", "document_rejected", "account_approved", "account_suspended", "payment_confirmed"].includes(type)) return "/driver"
  return "/rider"
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 })
  if (!secret || request.headers.get("x-flyt-push-secret") !== secret) return new Response("Forbidden", { status: 403 })
  if (!publicKey || !privateKey) return new Response(JSON.stringify({ sent: 0, note: "No VAPID keys set" }), { status: 200 })

  const { notification_id: id } = (await request.json().catch(() => ({}))) as { notification_id?: string }
  if (!id) return new Response("Missing notification_id", { status: 400 })

  // The service role is available only inside Supabase functions; it never reaches the browser.
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } })
  const { data: note } = await db.from("notifications").select("id, auth_user_id, type, title, body, trip_id").eq("id", id).maybeSingle()
  if (!note) return new Response(JSON.stringify({ sent: 0 }), { status: 200 })
  const { data: subscriptions } = await db.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("auth_user_id", note.auth_user_id)

  webpush.setVapidDetails(subject, publicKey, privateKey)
  const payload = JSON.stringify({ title: note.title, body: note.body, type: note.type, tag: note.id, link: linkFor(note.type, note.trip_id) })
  let sent = 0
  for (const row of subscriptions ?? []) {
    try {
      await webpush.sendNotification({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, payload, { TTL: note.type === "offer_new" ? 20 : 3600, urgency: note.type === "offer_new" ? "high" : "normal" })
      sent += 1
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode
      // The browser unsubscribed: forget it.
      if (status === 404 || status === 410) await db.from("push_subscriptions").delete().eq("id", row.id)
    }
  }
  return new Response(JSON.stringify({ sent }), { status: 200, headers: { "content-type": "application/json" } })
})
