import { buildSeed, type MockDb } from "../lib/mock-data"
import { placeDistances, places } from "../lib/places"

// SQL generated from the app's own data, so Supabase and the mock demo start from the same rows.
// tests/supabase-sync.test.ts checks the committed files match; run it with UPDATE_SQL=1 to rewrite them.

const q = (value: string) => `'${value.replace(/'/g, "''")}'`
const v = (value: unknown): string => {
  if (value == null) return "null"
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  if (Array.isArray(value)) return value.length ? `array[${value.map((item) => v(item)).join(", ")}]` : "'{}'"
  if (typeof value === "object") return `${q(JSON.stringify(value))}::jsonb`
  return q(String(value))
}

const j = (value: unknown) => `${q(JSON.stringify(value))}::jsonb`

export function placesSql() {
  return [
    "-- Reference data: the 10 Kigali places of version 1 and road distances. Generated from lib/places.ts (scripts/supabase-sql.ts).",
    "insert into public.places (id, name, lat, lng) values",
    places.map((place) => `  (${q(place.id)}, ${q(place.name)}, ${place.lat ?? "null"}, ${place.lng ?? "null"})`).join(",\n") + ";",
    "",
    "insert into public.place_distances (from_place, to_place, km) values",
    placeDistances.map((row) => `  (${q(row.from)}, ${q(row.to)}, ${row.km})`).join(",\n") + ";",
    "",
  ].join("\n")
}

/** The fixed moment the seed is built from. Every time in seed.sql is written relative to it, so the demo always looks current. */
export const SEED_REFERENCE = new Date("2026-11-19T08:00:00Z")
/** Password for the local dev email sign-in only (NEXT_PUBLIC_DEV_SIGNIN=true against a local Supabase). Never used in production. */
export const DEV_PASSWORD = "flyt-dev-only"
export const devEmail = (id: string) => `${id}@flyt.test`
/** SMS code for every seeded phone in local Supabase ([auth.sms.test_otp] in supabase/config.toml). */
export const TEST_OTP = "123456"

const phoneDigits = (phone: string) => `250${phone.replace(/\D/g, "").slice(-9)}`
/** A fixed uuid per seeded person, so auth users and app rows link the same way every reset. */
export function seedUuid(id: string) {
  let hash = 0
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  const hex = hash.toString(16).padStart(8, "0")
  return `${hex}-0000-4000-8000-${id.length.toString(16).padStart(4, "0")}${hex}`
}

export function seedPeople(seed: MockDb = buildSeed(SEED_REFERENCE)) {
  return [...seed.riders.map((row) => ({ id: row.id, phone: row.phone })), ...seed.drivers.map((row) => ({ id: row.id, phone: row.phone })), ...seed.admins.map((row) => ({ id: row.id, phone: row.phone }))]
}

export function testOtpToml(seed: MockDb = buildSeed(SEED_REFERENCE)) {
  const phones = [...new Set(seedPeople(seed).map((person) => phoneDigits(person.phone)))]
  return phones.map((phone) => `${phone} = "${TEST_OTP}"`).join("\n")
}

export function seedSql(seed: MockDb = buildSeed(SEED_REFERENCE)) {
  const ref = SEED_REFERENCE
  const kigaliDay = new Date(ref.getTime() + 2 * 3_600_000).toISOString().slice(0, 10)
  const midnight = Date.parse(`${kigaliDay}T00:00:00Z`) - 2 * 3_600_000
  const at = (iso: string | undefined) => (iso ? `pg_temp.at(${Math.round((Date.parse(iso) - midnight) / 60_000)})` : "null")
  const day = (date: string | undefined) => (date ? `pg_temp.day(${Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${kigaliDay}T00:00:00Z`)) / 86_400_000)})` : "null")
  const rows = (table: string, columns: string[], values: string[][]) => (values.length ? `insert into public.${table} (${columns.join(", ")}) values\n${values.map((row) => `  (${row.join(", ")})`).join(",\n")};\n` : "")
  const out: string[] = []
  out.push(`-- Local demo data for Supabase, generated from lib/mock-data.ts (scripts/supabase-sql.ts). Loaded by supabase db reset.
-- Names, phone numbers, TINs, licence numbers and merchant codes are made up.
-- Times are relative to midnight in Kigali today, and dates to today, so the demo always looks current.
-- Local sign-in: SMS code ${TEST_OTP} for every seeded phone (config.toml), or the dev email sign-in
-- (<id>@flyt.test, password in scripts/supabase-sql.ts) when NEXT_PUBLIC_DEV_SIGNIN=true. Both are local only.

create function pg_temp.at(minutes integer) returns timestamptz language sql stable as $$
  select (date_trunc('day', now() at time zone 'Africa/Kigali') at time zone 'Africa/Kigali') + minutes * interval '1 minute'
$$;
create function pg_temp.day(days integer) returns date language sql stable as $$
  select (now() at time zone 'Africa/Kigali')::date + days
$$;
`)
  out.push(rows("pricing_plans", ["name", "first_km", "per_km", "shared_seat_percent", "is_active"], seed.pricing.plans.map((plan) => [v(plan.name), v(plan.firstKm), v(plan.perKm), v(plan.sharedSeatPercent), v(plan.isActive)])))
  out.push(rows("airport_zones", ["place_id", "price"], seed.pricing.airportZones.map((zone) => [v(zone.placeId), v(zone.price)])))
  out.push(rows("firms", ["id", "name", "type", "rura_licence_no", "licence_expiry", "tin", "momo_merchant_code", "airtel_merchant_code", "fee_percent", "hourly_rate", "daily_rate", "status"], seed.firms.map((firm) => [v(firm.id), v(firm.name), v(firm.type), v(firm.ruraLicenceNo), day(firm.licenceExpiry), v(firm.tin), v(firm.momoMerchantCode), v(firm.airtelMerchantCode), v(firm.feePercent), v(firm.hourlyRate), v(firm.dailyRate), v(firm.status)])))
  out.push(rows("companies", ["id", "name", "contact_name", "phone", "staff_count", "status", "join_code"], seed.companies.map((company) => [v(company.id), v(company.name), v(company.contactName), v(company.phone), v(company.staffCount), v(company.status), v(company.joinCode)])))
  out.push(rows("riders", ["id", "name", "phone", "language", "company_id", "saved_places", "emergency_contacts", "consent_at", "created_at"], seed.riders.map((rider) => [v(rider.id), v(rider.name), v(rider.phone), v(rider.language), v(rider.companyId), j(rider.savedPlaces), j(rider.emergencyContacts), at(rider.consentAt), at(rider.createdAt)])))
  out.push(rows("cars", ["id", "firm_id", "plate", "make", "model", "colour", "year", "seats", "power", "availability", "zone"], seed.cars.map((car) => [v(car.id), v(car.firmId), v(car.plate), v(car.make), v(car.model), v(car.colour), v(car.year), v(car.seats), v(car.power), v(car.availability), v(car.zone)])))
  out.push(rows("drivers", ["id", "firm_id", "name", "phone", "rating", "status", "approval", "zone", "car_id", "suspend_after_trip"], seed.drivers.map((driver) => [v(driver.id), v(driver.firmId), v(driver.name), v(driver.phone), v(driver.rating), v(driver.status), v(driver.approval), v(driver.zone), v(driver.carId), v(!!driver.suspendAfterTrip)])))
  const docs = [...seed.drivers.flatMap((driver) => driver.documents.map((doc) => ({ doc, driver: driver.id, car: undefined as string | undefined }))), ...seed.cars.flatMap((car) => car.documents.map((doc) => ({ doc, driver: undefined as string | undefined, car: car.id })))]
  out.push(rows("documents", ["id", "driver_id", "car_id", "type", "expiry_date", "review", "reject_reason"], docs.map(({ doc, driver, car }) => [v(doc.id), v(driver), v(car), v(doc.type), day(doc.expiryDate), v(doc.review), v(doc.rejectReason)])))
  out.push(rows("commute_routes", ["id", "company_id", "name", "stops", "departure_times", "seats_per_car", "rider_ids"], seed.commuteRoutes.map((route) => [v(route.id), v(route.companyId), v(route.name), v(route.stops), v(route.departureTimes), v(route.seatsPerCar), v(route.riderIds)])))
  const tripColumns = ["id", "type", "rider_id", "company_id", "firm_id", "driver_id", "car_id", "pickup", "dropoff", "distance_km", "hire_quantity", "scheduled_for", "fare", "platform_fee", "plan_name", "status", "payment_method", "payment_status", "receipt_no", "rider_rating", "rating_tags", "rating_comment", "driver_rating", "cancel_reason", "cancelled_by", "commute_route_id", "created_at", "updated_at", "assigned_at", "accepted_at", "arrived_at", "started_at", "completed_at", "cancelled_at", "rider_paid_at", "paid_at"]
  out.push(rows("trips", tripColumns, seed.trips.map((trip) => [v(trip.id), v(trip.type), v(trip.riderId), v(trip.companyId), v(trip.firmId), v(trip.driverId), v(trip.carId), v(trip.pickup), v(trip.dropoff), v(trip.distanceKm), v(trip.hireQuantity), at(trip.scheduledFor), v(trip.fare), v(trip.platformFee), v(trip.planName), v(trip.status), v(trip.paymentMethod), v(trip.paymentStatus), v(trip.receiptNo), v(trip.riderRating), trip.ratingTags ? `${v(trip.ratingTags)}::text[]` : "null", v(trip.ratingComment), v(trip.driverRating), v(trip.cancelReason), v(trip.cancelledBy), v(trip.commuteRouteId), at(trip.createdAt), at(trip.updatedAt), at(trip.assignedAt), at(trip.acceptedAt), at(trip.arrivedAt), at(trip.startedAt), at(trip.completedAt), at(trip.cancelledAt), at(trip.riderPaidAt), at(trip.paidAt)])))
  out.push(`-- The assigned trip has its 20-second job offer open from the moment the data is loaded.\n` + rows("job_offers", ["id", "trip_id", "driver_id", "status", "created_at", "expires_at"], seed.offers.map((offer) => [v(offer.id), v(offer.tripId), v(offer.driverId), v(offer.status), "now()", "now() + interval '20 seconds'"])))
  out.push(rows("incidents", ["id", "trip_id", "type", "description", "status", "notes", "reported_by", "created_at"], seed.incidents.map((incident) => [v(incident.id), v(incident.tripId), v(incident.type), v(incident.description), v(incident.status), incident.notes.length ? `${v(incident.notes)}::text[]` : "'{}'", v(incident.reportedBy), at(incident.createdAt)])))
  out.push(rows("admins", ["id", "name", "phone", "role", "firm_id", "company_id"], seed.admins.map((admin) => [v(admin.id), v(admin.name), v(admin.phone), v(admin.role), v(admin.firmId), v(admin.companyId)])))
  out.push(`-- Last month's invoices, worked out by Postgres from the trips above: the first firm and company have paid, the rest are sent.
do $$
declare last_month text := to_char((now() at time zone 'Africa/Kigali') - interval '1 month', 'YYYY-MM');
begin
  perform app.build_invoices(last_month);
  update public.fee_invoices set status = case when firm_id = 'firm-1' then 'paid' else 'sent' end::public.invoice_status where period = last_month;
  update public.company_invoices set status = case when company_id = 'co-1' then 'paid' else 'sent' end::public.invoice_status where period = last_month;
end $$;
`)
  // Auth users for local sign-in. One per seeded person: phone (SMS test code) and a dev email.
  const people = seedPeople(seed)
  const users = people.map((person) => ({ ...person, uuid: seedUuid(person.id), digits: phoneDigits(person.phone), email: devEmail(person.id) }))
  out.push(`-- Local auth users: one per seeded rider, driver and team member.
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, phone, phone_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change, phone_change, phone_change_token, email_change_token_current, reauthentication_token)
select '00000000-0000-0000-0000-000000000000', u.id::uuid, 'authenticated', 'authenticated', u.email, extensions.crypt(${q(DEV_PASSWORD)}, extensions.gen_salt('bf')), now(), u.phone, now(),
  '{"provider":"phone","providers":["phone","email"]}', '{}', now(), now(), '', '', '', '', '', '', '', ''
from (values
${users.map((user) => `  (${q(user.uuid)}, ${q(user.email)}, ${q(user.digits)})`).join(",\n")}
) as u(id, email, phone);

insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id, id::text, 'phone', jsonb_build_object('sub', id::text, 'phone', phone, 'phone_verified', true), now(), now(), now() from auth.users where email like '%@flyt.test'
union all
select gen_random_uuid(), id, id::text, 'email', jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true), now(), now(), now() from auth.users where email like '%@flyt.test';

update public.riders r set auth_user_id = u.id from auth.users u where u.email = r.id || '@flyt.test';
update public.drivers d set auth_user_id = u.id from auth.users u where u.email = d.id || '@flyt.test';
update public.admins a set auth_user_id = u.id from auth.users u where u.email = a.id || '@flyt.test';
`)
  // Local only: browser push goes to the local push function (supabase functions serve) with a dev secret.
  out.push(`-- Local browser push: the push function inside the local Supabase network, with a dev-only secret.
insert into app.push_settings (function_url, secret) values ('http://supabase_kong_Flyt:8000/functions/v1/push', 'local-dev-push-secret');
`)
  return out.filter(Boolean).join("\n")
}
