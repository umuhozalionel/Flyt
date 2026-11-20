-- Additions approved for Phase 6 (screens follow in Phase 6B). All free and code-only.
--  1 notifications (in-app centre, browser push subscriptions, per-type mute)   8 live trip-sharing links
--  2 trip PIN                                                                   9 lost and found
--  3 rider–driver chat   4 company admin–driver chat                          10 driver bonuses (tracking only, off)
--  5 favourite drivers   6 driver preferences   7 busy areas                  11 reward points (tracking only)
-- 12 tips straight to the driver's MoMo number (per firm, off)                13 verified badge for company riders
-- Rules b and c apply: companies only reach company-billed trips; no rider phone in chat or on shared pages.

create extension if not exists pg_cron with schema pg_catalog;

-- Switches for features that are off or limited by default.
create table public.app_settings (
  key text primary key,
  value jsonb not null
);
insert into public.app_settings values
  ('bonuses_enabled', 'false'),           -- 10: Ops turns targets on; the app tracks progress and pays nothing
  ('points_per_1000_rwf', '1'),           -- 11: points for each full Rwf 1,000 of a completed fare
  ('points_redemption_enabled', 'false'), -- 11: redemption stays off
  ('request_waiting_minutes', '5'),       -- 1: "request waiting too long" for admins
  ('scheduled_reminder_minutes', '30');   -- 1: reminder before a scheduled ride

-- ── 1. Notifications ──────────────────────────────────────────────────────────────────────

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in (
    'offer_new', 'trip_cancelled_by_rider', 'scheduled_reminder', 'document_expiring_30', 'document_expiring_7', 'document_approved', 'document_rejected',
    'account_approved', 'account_suspended', 'payment_confirmed',
    'driver_assigned', 'driver_arriving', 'driver_arrived', 'trip_started', 'receipt_ready',
    'invoice_sent', 'incident_opened', 'request_waiting', 'chat_message')),
  title text not null,
  body text not null,
  link text,
  trip_id text references public.trips (id) on delete cascade,
  -- One notification per event: the same key is never sent twice to the same person.
  dedupe_key text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (auth_user_id, dedupe_key)
);
create index notifications_user_idx on public.notifications (auth_user_id, created_at desc);

create table public.notification_mutes (
  auth_user_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  primary key (auth_user_id, type)
);

-- Browser push (Web Push with VAPID keys, free). The sender runs on the server in Phase 6B.
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique check (endpoint like 'https://%'),
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

/** Adds a notification unless the person muted that type or already has it. Never fails the action that caused it. */
create function app.notify(p_user uuid, p_type text, p_title text, p_body text, p_dedupe text, p_trip text default null, p_link text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_user is null then return; end if;
  if exists (select 1 from public.notification_mutes where auth_user_id = p_user and type = p_type) then return; end if;
  insert into public.notifications (auth_user_id, type, title, body, link, trip_id, dedupe_key)
  values (p_user, p_type, p_title, p_body, p_link, p_trip, p_dedupe)
  on conflict (auth_user_id, dedupe_key) do nothing;
end $$;

create function public.mark_notifications_read(p_ids uuid[] default null) returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  update public.notifications set read_at = now() where auth_user_id = auth.uid() and read_at is null and (p_ids is null or id = any (p_ids));
  get diagnostics n = row_count;
  return n;
end $$;

create function public.set_notification_mute(p_type text, p_muted boolean) returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if p_muted then insert into public.notification_mutes values (auth.uid(), p_type) on conflict do nothing;
  else delete from public.notification_mutes where auth_user_id = auth.uid() and type = p_type; end if;
end $$;

create function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text) returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  insert into public.push_subscriptions (auth_user_id, endpoint, p256dh, auth) values (auth.uid(), p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update set auth_user_id = excluded.auth_user_id, p256dh = excluded.p256dh, auth = excluded.auth;
end $$;

create function public.delete_push_subscription(p_endpoint text) returns void language sql security definer set search_path = '' as $$
  delete from public.push_subscriptions where endpoint = p_endpoint and auth_user_id = auth.uid()
$$;

-- ── 2. Trip PIN ───────────────────────────────────────────────────────────────────────────
-- Kept out of the trips table so the driver can never read it. Only the rider (and platform admins) see it.

create table public.trip_pins (
  trip_id text primary key references public.trips (id) on delete cascade,
  pin text not null check (pin ~ '^\d{4}$'),
  wrong_tries integer not null default 0
);

create function app.trip_pin_on_insert() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.trip_pins (trip_id, pin) values (new.id, lpad((floor(random() * 10000))::integer::text, 4, '0'));
  return new;
end $$;
create trigger trips_pin after insert on public.trips for each row execute function app.trip_pin_on_insert();

/** The driver must enter the rider's 4-digit PIN to start the trip. After 5 wrong tries, Flyt Operations must help. */
drop function public.start_trip(text);
create function public.start_trip(p_trip text, p_pin text) returns public.trips language plpgsql security definer set search_path = '' as $$
declare p public.trip_pins;
begin
  perform app.require_trip_driver(p_trip);
  select * into p from public.trip_pins where trip_id = p_trip for update;
  if p.wrong_tries >= 5 then raise exception 'Too many wrong PINs. Call Flyt Operations'; end if;
  if p.pin is distinct from p_pin then
    update public.trip_pins set wrong_tries = wrong_tries + 1 where trip_id = p_trip;
    -- The failed try must be kept, so this returns an error code instead of raising (which would undo the count).
    return null;
  end if;
  return app.move_trip(p_trip, 'in_progress');
end $$;

-- ── 3, 4, 9. Chat ────────────────────────────────────────────────────────────────────────

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  trip_id text not null references public.trips (id) on delete cascade,
  -- rider_driver: the rider and the driver of the trip. company_driver: the company admin and the driver, company-billed trips only.
  channel text not null check (channel in ('rider_driver', 'company_driver')),
  sender text not null check (sender in ('rider', 'driver', 'company')),
  sender_id text not null,
  body text not null check (char_length(body) between 1 and 500),
  quick_reply boolean not null default false,
  created_at timestamptz not null default now()
);
create index chat_messages_trip_idx on public.chat_messages (trip_id, created_at);

-- ── 5. Favourite drivers ─────────────────────────────────────────────────────────────────

create table public.favourite_drivers (
  rider_id text not null references public.riders (id) on delete cascade,
  driver_id text not null references public.drivers (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (rider_id, driver_id)
);

-- ── 6. Driver preferences ────────────────────────────────────────────────────────────────

create table public.driver_preferences (
  driver_id text primary key references public.drivers (id) on delete cascade,
  ride_types public.trip_type[] not null default array['private', 'shared_commute', 'hourly', 'daily', 'airport']::public.trip_type[] check (cardinality(ride_types) >= 1),
  heading_home_zone text references public.places (id),
  heading_home_until timestamptz
);

-- ── 8. Live trip-sharing links ───────────────────────────────────────────────────────────
-- The link carries a random token; only its SHA-256 hash is stored. It stops working when the trip ends.

create table public.trip_shares (
  token_hash text primary key,
  trip_id text not null references public.trips (id) on delete cascade,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

-- ── 9. Lost and found ────────────────────────────────────────────────────────────────────

create table public.lost_items (
  id text primary key default ('LOST-' || substr(md5(gen_random_uuid()::text), 1, 6)),
  trip_id text not null references public.trips (id),
  rider_id text not null references public.riders (id),
  incident_id text not null references public.incidents (id),
  description text not null check (char_length(description) between 1 and 500),
  status text not null default 'open' check (status in ('open', 'found', 'returned', 'not_found')),
  -- Chat with the driver reopens for 24 hours from the report.
  chat_open_until timestamptz not null,
  created_at timestamptz not null default now()
);

-- ── 10. Driver bonuses (tracking only, nothing is paid) ──────────────────────────────────

create table public.bonus_targets (
  id text primary key default ('bonus-' || substr(md5(gen_random_uuid()::text), 1, 8)),
  name text not null,
  metric text not null check (metric in ('completed_trips')),
  period text not null check (period in ('day', 'week', 'month')),
  target integer not null check (target >= 1),
  firm_id text references public.firms (id),
  active boolean not null default false,
  created_at timestamptz not null default now()
);

-- ── 11. Reward points (tracking only, redemption off, fares and receipts unchanged) ──────

create table public.reward_points (
  id uuid primary key default gen_random_uuid(),
  rider_id text not null references public.riders (id) on delete cascade,
  trip_id text unique references public.trips (id),
  points integer not null,
  reason text not null,
  created_at timestamptz not null default now()
);

-- ── 12. Tips (off by default per firm; paid by MoMo straight to the driver, Flyt never holds the money) ──

alter table public.firms add column tips_enabled boolean not null default false;
alter table public.drivers add column tip_momo_number text;

create table public.tips (
  id uuid primary key default gen_random_uuid(),
  trip_id text not null unique references public.trips (id),
  rider_id text not null references public.riders (id),
  driver_id text not null references public.drivers (id),
  amount integer not null check (amount > 0 and amount <= 50000),
  -- The rider says they sent it by MoMo; Flyt does not see or move the money.
  rider_sent_at timestamptz not null default now()
);

-- ── Arrival estimate for "driver arriving" notices ───────────────────────────────────────
alter table public.trips add column pickup_eta_minutes integer;

-- ── Row level security for the new tables ────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['app_settings','notifications','notification_mutes','push_subscriptions','trip_pins','chat_messages','favourite_drivers','driver_preferences','trip_shares','lost_items','bonus_targets','reward_points','tips'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;
-- Share tokens are never readable; the public page goes through shared_trip().
revoke select on public.trip_shares from authenticated;

create policy "settings readable" on public.app_settings for select to authenticated using (true);
create policy "own notifications" on public.notifications for select to authenticated using (auth_user_id = auth.uid());
create policy "own mutes" on public.notification_mutes for select to authenticated using (auth_user_id = auth.uid());
create policy "own push subscriptions" on public.push_subscriptions for select to authenticated using (auth_user_id = auth.uid());
create policy "pin: rider of the trip" on public.trip_pins for select to authenticated using (
  app.is_platform() or exists (select 1 from public.trips t where t.id = trip_pins.trip_id and t.rider_id = app.rider_id())
);

/** Who may read and write a chat channel on a trip. */
create function app.chat_role(t public.trips, p_channel text) returns text language sql stable security definer set search_path = '' as $$
  select case
    when p_channel = 'rider_driver' and t.rider_id = app.rider_id() then 'rider'
    when t.driver_id is not null and t.driver_id = app.driver_id() then 'driver'
    -- Rule b: a company admin only reaches company-billed trips.
    when p_channel = 'company_driver' and t.payment_method = 'company_account' and t.company_id = app.admin_company() then 'company'
  end
$$;

create policy "chat: participants" on public.chat_messages for select to authenticated using (
  app.is_platform() or exists (select 1 from public.trips t where t.id = chat_messages.trip_id and app.chat_role(t, chat_messages.channel) is not null)
);
create policy "favourites: own" on public.favourite_drivers for select to authenticated using (app.is_platform() or rider_id = app.rider_id());
create policy "preferences" on public.driver_preferences for select to authenticated using (
  app.is_platform() or driver_id = app.driver_id() or exists (select 1 from public.drivers d where d.id = driver_preferences.driver_id and d.firm_id = app.admin_firm())
);
create policy "lost items" on public.lost_items for select to authenticated using (
  app.is_platform() or rider_id = app.rider_id()
  or exists (select 1 from public.trips t where t.id = lost_items.trip_id and (t.driver_id = app.driver_id() or t.firm_id = app.admin_firm()))
);
create policy "bonus targets" on public.bonus_targets for select to authenticated using (
  app.is_platform() or ((firm_id is null or firm_id = app.admin_firm() or firm_id = (select firm_id from public.drivers where id = app.driver_id())) and (app.admin_firm() is not null or app.driver_id() is not null))
);
create policy "points: own" on public.reward_points for select to authenticated using (app.is_platform() or rider_id = app.rider_id());
create policy "tips" on public.tips for select to authenticated using (
  app.is_platform() or rider_id = app.rider_id() or driver_id = app.driver_id()
  or exists (select 1 from public.drivers d where d.id = tips.driver_id and d.firm_id = app.admin_firm())
);

-- ── RPC functions ────────────────────────────────────────────────────────────────────────

create function app.chat_open(t public.trips) returns boolean language sql stable security definer set search_path = '' as $$
  select t.status in ('assigned', 'driver_arriving', 'driver_arrived', 'in_progress')
    or exists (select 1 from public.lost_items l where l.trip_id = t.id and l.chat_open_until > now())
$$;

/** Send a chat message. Open only while the trip is active (or 24 h after a lost-item report). No phone numbers. */
create function public.send_chat(p_trip text, p_channel text, p_body text, p_quick_reply boolean default false) returns public.chat_messages language plpgsql security definer set search_path = '' as $$
declare
  t public.trips;
  who text;
  m public.chat_messages;
  body text := trim(p_body);
begin
  select * into t from public.trips where id = p_trip;
  if not found then raise exception 'Trip not found'; end if;
  who := app.chat_role(t, p_channel);
  if who is null then raise exception 'This is not your trip' using errcode = '42501'; end if;
  if not app.chat_open(t) then raise exception 'Chat is closed for this trip'; end if;
  if body = '' then raise exception 'Write a message'; end if;
  -- No phone numbers in chat (rule c): 7 or more digits, with or without spaces, dots or dashes.
  if regexp_replace(body, '[\s.\-()+]', '', 'g') ~ '\d{7,}' then raise exception 'Phone numbers cannot be sent in chat'; end if;
  insert into public.chat_messages (trip_id, channel, sender, sender_id, body, quick_reply)
  values (t.id, p_channel, who, coalesce(app.rider_id(), app.driver_id(), app.admin_id()), left(body, 500), p_quick_reply)
  returning * into m;
  -- Tell the other side.
  if who <> 'driver' then
    perform app.notify((select auth_user_id from public.drivers where id = t.driver_id), 'chat_message', 'New message', left(body, 120), 'chat:' || m.id, t.id);
  elsif p_channel = 'rider_driver' then
    perform app.notify((select auth_user_id from public.riders where id = t.rider_id), 'chat_message', 'New message from your driver', left(body, 120), 'chat:' || m.id, t.id);
  end if;
  return m;
end $$;

/** A rider can favourite a driver who drove one of their completed trips. */
create function public.set_favourite_driver(p_driver text, p_favourite boolean) returns void language plpgsql security definer set search_path = '' as $$
declare me text := app.rider_id();
begin
  if me is null then raise exception 'Sign in first'; end if;
  if p_favourite then
    if not exists (select 1 from public.trips where rider_id = me and driver_id = p_driver and status = 'completed') then
      raise exception 'You can favourite a driver after a trip with them';
    end if;
    insert into public.favourite_drivers (rider_id, driver_id) values (me, p_driver) on conflict do nothing;
  else
    delete from public.favourite_drivers where rider_id = me and driver_id = p_driver;
  end if;
end $$;

create function public.set_driver_preferences(p_ride_types public.trip_type[], p_heading_home_zone text default null, p_heading_home_until timestamptz default null) returns public.driver_preferences language plpgsql security definer set search_path = '' as $$
declare
  me text := app.driver_id();
  p public.driver_preferences;
begin
  if me is null then raise exception 'Sign in first'; end if;
  if cardinality(p_ride_types) < 1 then raise exception 'Pick at least one ride type'; end if;
  if p_heading_home_zone is not null and (p_heading_home_until is null or p_heading_home_until <= now() or p_heading_home_until > now() + interval '12 hours') then
    raise exception 'Heading home lasts up to 12 hours';
  end if;
  insert into public.driver_preferences (driver_id, ride_types, heading_home_zone, heading_home_until) values (me, p_ride_types, p_heading_home_zone, p_heading_home_until)
  on conflict (driver_id) do update set ride_types = excluded.ride_types, heading_home_zone = excluded.heading_home_zone, heading_home_until = excluded.heading_home_until
  returning * into p;
  return p;
end $$;

/**
 * Dispatch suggestions for a waiting trip: free drivers who accept the ride type, nearest first.
 * A driver heading home is only suggested when the drop-off is their home area. On a scheduled ride,
 * the rider's favourite drivers come first. Suggestions only: Ops still assigns by hand.
 */
create function public.dispatch_suggestions(p_trip text) returns table (driver_id text, km numeric, favourite boolean, heading_home boolean) language plpgsql stable security definer set search_path = '' as $$
declare t public.trips;
begin
  select * into t from public.trips where id = p_trip;
  if not found then raise exception 'Trip not found'; end if;
  perform app.require_firm_access(t.firm_id);
  return query
  select d.id, case when d.zone = t.pickup then 0 else app.distance_km(d.zone, t.pickup) end as km,
         exists (select 1 from public.favourite_drivers f where f.rider_id = t.rider_id and f.driver_id = d.id) as favourite,
         (p.heading_home_until > now()) is true as heading_home
  from public.drivers d
  join public.cars c on c.id = d.car_id and c.availability = 'available'
  join public.firms fm on fm.id = d.firm_id and fm.status = 'active'
  left join public.driver_preferences p on p.driver_id = d.id
  where d.approval = 'approved' and d.status = 'online'
    and (app.is_platform() or d.firm_id = app.admin_firm())
    and (t.type not in ('hourly', 'daily') or d.firm_id = t.firm_id)
    and (p.driver_id is null or t.type = any (p.ride_types))
    and (p.heading_home_until is null or p.heading_home_until <= now() or p.heading_home_zone = t.dropoff)
  order by (t.status = 'scheduled' and exists (select 1 from public.favourite_drivers f where f.rider_id = t.rider_id and f.driver_id = d.id)) desc, km, d.id;
end $$;

/** Waiting requests per zone, for the driver home screen. Counts only, no rider details. */
create function public.busy_areas() returns table (zone text, waiting integer) language sql stable security definer set search_path = '' as $$
  select pickup, count(*)::integer from public.trips
  where (status = 'requested' or (status = 'scheduled' and scheduled_for < now() + interval '1 hour'))
    and (app.driver_id() is not null or app.is_platform() or app.admin_firm() is not null)
  group by pickup order by count(*) desc, pickup
$$;

/** The rider makes a sharing link for an active trip. Returns the token once; only its hash is kept. */
create function public.create_trip_share(p_trip text) returns text language plpgsql security definer set search_path = '' as $$
declare
  t public.trips;
  token text := encode(extensions.gen_random_bytes(24), 'hex');
begin
  select * into t from public.trips where id = p_trip and rider_id = app.rider_id();
  if not found then raise exception 'Trip not found'; end if;
  if t.status in ('completed', 'cancelled_by_rider', 'cancelled_by_driver', 'no_driver_found') then raise exception 'This trip has ended'; end if;
  insert into public.trip_shares (token_hash, trip_id) values (encode(extensions.digest(token, 'sha256'), 'hex'), t.id);
  return token;
end $$;

create function public.revoke_trip_shares(p_trip text) returns void language sql security definer set search_path = '' as $$
  update public.trip_shares set revoked_at = now() where trip_id = p_trip and revoked_at is null
    and exists (select 1 from public.trips where id = p_trip and rider_id = app.rider_id())
$$;

/**
 * The read-only sharing page (no sign-in). Works while the trip is not finished and the link is not revoked.
 * Shows no phone numbers and no fare: status, places, times, the driver's first name and the car.
 */
create function public.shared_trip(p_token text) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  t public.trips;
  d public.drivers;
  c public.cars;
begin
  select tr.* into t from public.trip_shares s join public.trips tr on tr.id = s.trip_id
  where s.token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex') and s.revoked_at is null;
  if not found or t.status in ('completed', 'cancelled_by_rider', 'cancelled_by_driver', 'no_driver_found') then return null; end if;
  select * into d from public.drivers where id = t.driver_id;
  select * into c from public.cars where id = t.car_id;
  return jsonb_build_object('status', t.status, 'type', t.type, 'pickup', t.pickup, 'dropoff', t.dropoff, 'acceptedAt', t.accepted_at, 'arrivedAt', t.arrived_at,
    'startedAt', t.started_at, 'pickupEtaMinutes', t.pickup_eta_minutes, 'driverFirstName', split_part(d.name, ' ', 1),
    'car', case when c.id is null then null else jsonb_build_object('plate', c.plate, 'make', c.make, 'model', c.model, 'colour', c.colour) end);
end $$;
grant execute on function public.shared_trip to anon;

/** The rider reports an item left in the car: an incident is opened and chat with the driver reopens for 24 hours. */
create function public.report_lost_item(p_trip text, p_description text) returns public.lost_items language plpgsql security definer set search_path = '' as $$
declare
  t public.trips;
  i public.incidents;
  l public.lost_items;
begin
  select * into t from public.trips where id = p_trip and rider_id = app.rider_id();
  if not found then raise exception 'Trip not found'; end if;
  if t.status <> 'completed' or t.driver_id is null then raise exception 'Report a lost item after a completed trip'; end if;
  if t.completed_at < now() - interval '30 days' then raise exception 'Lost items can be reported up to 30 days after the trip'; end if;
  if nullif(trim(p_description), '') is null then raise exception 'Describe the item'; end if;
  insert into public.incidents (trip_id, type, description, reported_by) values (t.id, 'lost_item', 'Lost item: ' || left(trim(p_description), 480), 'rider') returning * into i;
  insert into public.lost_items (trip_id, rider_id, incident_id, description, chat_open_until)
  values (t.id, t.rider_id, i.id, left(trim(p_description), 500), now() + interval '24 hours') returning * into l;
  return l;
end $$;

create function public.update_lost_item(p_item text, p_status text) returns public.lost_items language plpgsql security definer set search_path = '' as $$
declare l public.lost_items;
begin
  select * into l from public.lost_items where id = p_item for update;
  if not found then raise exception 'Not found'; end if;
  perform app.require_firm_access((select firm_id from public.trips where id = l.trip_id));
  update public.lost_items set status = p_status where id = p_item returning * into l;
  return l;
end $$;

/** Ops sets bonus targets. Tracking only: nothing is paid by the app. */
create function public.save_bonus_target(p_id text, p_name text, p_period text, p_target integer, p_firm text default null, p_active boolean default false) returns public.bonus_targets language plpgsql security definer set search_path = '' as $$
declare b public.bonus_targets;
begin
  perform app.require_platform();
  insert into public.bonus_targets (id, name, metric, period, target, firm_id, active)
  values (coalesce(p_id, 'bonus-' || substr(md5(gen_random_uuid()::text), 1, 8)), trim(p_name), 'completed_trips', p_period, p_target, p_firm, p_active)
  on conflict (id) do update set name = excluded.name, period = excluded.period, target = excluded.target, firm_id = excluded.firm_id, active = excluded.active
  returning * into b;
  return b;
end $$;

create function public.set_setting(p_key text, p_value jsonb) returns void language plpgsql security definer set search_path = '' as $$
begin
  perform app.require_platform();
  update public.app_settings set value = p_value where key = p_key;
  if not found then raise exception 'Unknown setting'; end if;
end $$;

/** A driver's progress on active targets (Kigali day, week from Monday, or month). Empty while bonuses are off. */
create function public.bonus_progress(p_driver text default null) returns table (target_id text, name text, period text, target integer, done integer) language sql stable security definer set search_path = '' as $$
  select b.id, b.name, b.period, b.target,
    (select count(*)::integer from public.trips t where t.driver_id = coalesce(p_driver, app.driver_id()) and t.status = 'completed'
       and date_trunc(b.period, t.completed_at at time zone 'Africa/Kigali') = date_trunc(b.period, now() at time zone 'Africa/Kigali'))
  from public.bonus_targets b, public.drivers d
  where d.id = coalesce(p_driver, app.driver_id())
    and (d.id = app.driver_id() or app.is_platform() or d.firm_id = app.admin_firm())
    and b.active and (b.firm_id is null or b.firm_id = d.firm_id)
    and (select value from public.app_settings where key = 'bonuses_enabled') = 'true'
$$;

create function public.set_firm_tips(p_firm text, p_enabled boolean) returns public.firms language plpgsql security definer set search_path = '' as $$
declare f public.firms;
begin
  perform app.require_firm_access(p_firm);
  update public.firms set tips_enabled = p_enabled where id = p_firm returning * into f;
  return f;
end $$;

create function public.set_tip_number(p_number text) returns public.drivers language plpgsql security definer set search_path = '' as $$
declare d public.drivers;
begin
  if app.driver_id() is null then raise exception 'Sign in first'; end if;
  update public.drivers set tip_momo_number = case when nullif(trim(p_number), '') is null then null else app.normal_phone(p_number) end
  where id = app.driver_id() returning * into d;
  return d;
end $$;

/**
 * After a completed trip, the MoMo number a rider can tip the driver on (when the firm allows tips and the driver
 * set a number). Shown only to that rider, only on the tip screen. Flyt never holds or moves the money.
 */
create function public.tip_details(p_trip text) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  t public.trips;
  d public.drivers;
begin
  select * into t from public.trips where id = p_trip and rider_id = app.rider_id();
  if not found or t.status <> 'completed' then return null; end if;
  select * into d from public.drivers where id = t.driver_id;
  if d.tip_momo_number is null or not (select tips_enabled from public.firms where id = d.firm_id) then return null; end if;
  return jsonb_build_object('driverFirstName', split_part(d.name, ' ', 1), 'momoNumber', d.tip_momo_number);
end $$;

create function public.record_tip(p_trip text, p_amount integer) returns public.tips language plpgsql security definer set search_path = '' as $$
declare
  t public.trips;
  x public.tips;
begin
  if public.tip_details(p_trip) is null then raise exception 'Tips are not available for this trip'; end if;
  select * into t from public.trips where id = p_trip;
  insert into public.tips (trip_id, rider_id, driver_id, amount) values (t.id, t.rider_id, t.driver_id, p_amount) returning * into x;
  return x;
end $$;

-- ── 13. Verified badge, and rule c for the driver view ───────────────────────────────────
-- A rider is "verified" when they are linked to an active client company. driver_job() now says so too.

create function app.rider_verified(p_rider text) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.riders r join public.companies c on c.id = r.company_id where r.id = p_rider and c.status = 'active')
$$;

create or replace function public.driver_job(p_trip text) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  t public.trips;
  r public.riders;
  rated numeric;
begin
  select * into t from public.trips where id = p_trip and driver_id = app.driver_id();
  if not found then return null; end if;
  select * into r from public.riders where id = t.rider_id;
  select round(avg(driver_rating), 1) into rated from public.trips where rider_id = t.rider_id and status = 'completed' and driver_rating is not null;
  return jsonb_build_object(
    'firstName', split_part(r.name, ' ', 1),
    'phone', case when t.status in ('assigned', 'driver_arriving', 'driver_arrived', 'in_progress') then r.phone end,
    'rating', rated,
    'tripCount', (select count(*) from public.trips where rider_id = t.rider_id and status = 'completed'),
    'verified', app.rider_verified(r.id)
  );
end $$;

-- ── Events that send notifications ───────────────────────────────────────────────────────

create function app.on_trip_change() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  rider_user uuid := (select auth_user_id from public.riders where id = new.rider_id);
  driver_user uuid := (select auth_user_id from public.drivers where id = new.driver_id);
  first_name text := (select split_part(name, ' ', 1) from public.drivers where id = new.driver_id);
  points_rate integer;
begin
  if new.status is distinct from old.status then
    case new.status
      when 'driver_arriving' then
        perform app.notify(rider_user, 'driver_assigned', 'Driver on the way', coalesce(first_name, 'Your driver') || ' accepted your ride.', 'trip:' || new.id || ':assigned', new.id);
      when 'driver_arrived' then
        perform app.notify(rider_user, 'driver_arrived', 'Your driver is here', coalesce(first_name, 'Your driver') || ' has arrived at the pickup.', 'trip:' || new.id || ':arrived', new.id);
      when 'in_progress' then
        perform app.notify(rider_user, 'trip_started', 'Trip started', 'Have a good ride.', 'trip:' || new.id || ':started', new.id);
      when 'completed' then
        perform app.notify(rider_user, 'receipt_ready', 'Receipt ready', 'Your receipt for trip ' || new.id || ' is ready.', 'trip:' || new.id || ':receipt', new.id);
        -- 11. Reward points: tracking only.
        points_rate := (select value::text::integer from public.app_settings where key = 'points_per_1000_rwf');
        if new.fare >= 1000 and points_rate > 0 then
          insert into public.reward_points (rider_id, trip_id, points, reason) values (new.rider_id, new.id, (new.fare / 1000) * points_rate, 'Completed trip')
          on conflict (trip_id) do nothing;
        end if;
      when 'cancelled_by_rider' then
        perform app.notify((select auth_user_id from public.drivers where id = old.driver_id), 'trip_cancelled_by_rider', 'Trip cancelled', 'The rider cancelled trip ' || new.id || '.', 'trip:' || new.id || ':cancelled', new.id);
      else null;
    end case;
    -- Trip ended: sharing links stop working.
    if new.status in ('completed', 'cancelled_by_rider', 'cancelled_by_driver', 'no_driver_found') then
      update public.trip_shares set revoked_at = now() where trip_id = new.id and revoked_at is null;
    end if;
  end if;
  if new.payment_status = 'paid' and old.payment_status is distinct from 'paid' then
    perform app.notify(driver_user, 'payment_confirmed', 'Payment confirmed', 'Payment for trip ' || new.id || ' is confirmed.', 'trip:' || new.id || ':paid', new.id);
  end if;
  return new;
end $$;
create trigger trips_notify after update on public.trips for each row execute function app.on_trip_change();

create function app.on_offer() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform app.notify((select auth_user_id from public.drivers where id = new.driver_id), 'offer_new', 'New trip offer', 'You have 20 seconds to accept.', 'offer:' || new.id, new.trip_id);
  return new;
end $$;
create trigger offers_notify after insert on public.job_offers for each row execute function app.on_offer();

create function app.on_document_review() returns trigger language plpgsql security definer set search_path = '' as $$
declare who uuid := (select auth_user_id from public.drivers where id = coalesce(new.driver_id, (select id from public.drivers where car_id = new.car_id)));
begin
  if old.review = 'pending_review' and new.review = 'on_file' then
    perform app.notify(who, 'document_approved', 'Document approved', replace(new.type::text, '_', ' ') || ' was approved.', 'doc:' || new.id || ':' || new.updated_at);
  elsif old.review = 'pending_review' and new.review = 'rejected' then
    perform app.notify(who, 'document_rejected', 'Document rejected', coalesce(new.reject_reason, 'Send a new one.'), 'doc:' || new.id || ':' || new.updated_at);
  end if;
  return new;
end $$;
create trigger documents_notify after update on public.documents for each row execute function app.on_document_review();

create function app.on_driver_approval() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.approval is distinct from old.approval then
    if new.approval = 'approved' then perform app.notify(new.auth_user_id, 'account_approved', 'Account approved', 'You can go online now.', 'approval:' || new.id || ':' || now());
    elsif new.approval = 'suspended' then perform app.notify(new.auth_user_id, 'account_suspended', 'Account suspended', 'Contact your firm or Flyt Operations.', 'approval:' || new.id || ':' || now()); end if;
  end if;
  return new;
end $$;
create trigger drivers_notify after update on public.drivers for each row execute function app.on_driver_approval();

create function app.on_invoice_sent() returns trigger language plpgsql security definer set search_path = '' as $$
declare a public.admins;
begin
  if new.status = 'sent' and old.status = 'draft' then
    for a in select * from public.admins where (tg_table_name = 'fee_invoices' and firm_id = (to_jsonb(new) ->> 'firm_id')) or (tg_table_name = 'company_invoices' and company_id = (to_jsonb(new) ->> 'company_id')) loop
      perform app.notify(a.auth_user_id, 'invoice_sent', 'Invoice sent', 'Invoice ' || new.id || ' for ' || new.period || ' is ready.', 'invoice:' || new.id);
    end loop;
  end if;
  return new;
end $$;
create trigger fee_invoices_notify after update on public.fee_invoices for each row execute function app.on_invoice_sent();
create trigger company_invoices_notify after update on public.company_invoices for each row execute function app.on_invoice_sent();

create function app.on_incident() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  t public.trips;
  a public.admins;
begin
  select * into t from public.trips where id = new.trip_id;
  for a in select * from public.admins
    where (t.id is not null and role = 'firm_admin' and firm_id = t.firm_id)
       or (t.id is not null and role = 'company_admin' and app.is_company_trip(t, company_id)) loop
    perform app.notify(a.auth_user_id, 'incident_opened', 'Incident opened', left(new.description, 120), 'incident:' || new.id, new.trip_id);
  end loop;
  return new;
end $$;
create trigger incidents_notify after insert on public.incidents for each row execute function app.on_incident();

/**
 * Time-based notices, run every minute by pg_cron: scheduled-ride reminders, "driver arriving" (2 minutes before the
 * estimate), documents expiring in 30 and 7 days, and requests waiting too long. Each is sent once (dedupe key).
 */
create function app.run_reminders() returns void language plpgsql security definer set search_path = '' as $$
declare
  remind integer := (select value::text::integer from public.app_settings where key = 'scheduled_reminder_minutes');
  wait integer := (select value::text::integer from public.app_settings where key = 'request_waiting_minutes');
  today date := (now() at time zone 'Africa/Kigali')::date;
  t public.trips;
  doc record;
  a public.admins;
begin
  perform public.expire_offers();
  for t in select * from public.trips where status in ('scheduled', 'assigned', 'driver_arriving') and scheduled_for between now() and now() + remind * interval '1 minute' loop
    perform app.notify((select auth_user_id from public.riders where id = t.rider_id), 'scheduled_reminder', 'Ride soon', 'Your scheduled ride is at ' || to_char(t.scheduled_for at time zone 'Africa/Kigali', 'HH24:MI') || '.', 'trip:' || t.id || ':reminder', t.id);
    perform app.notify((select auth_user_id from public.drivers where id = t.driver_id), 'scheduled_reminder', 'Scheduled ride soon', 'Pickup at ' || to_char(t.scheduled_for at time zone 'Africa/Kigali', 'HH24:MI') || '.', 'trip:' || t.id || ':reminder', t.id);
  end loop;
  for t in select * from public.trips where status = 'driver_arriving' and pickup_eta_minutes is not null and accepted_at + greatest(pickup_eta_minutes - 2, 0) * interval '1 minute' <= now() loop
    perform app.notify((select auth_user_id from public.riders where id = t.rider_id), 'driver_arriving', 'Driver almost there', 'About 2 minutes away.', 'trip:' || t.id || ':arriving', t.id);
  end loop;
  for doc in select d.id, d.type, d.expiry_date, coalesce(d.driver_id, (select id from public.drivers where car_id = d.car_id)) as driver from public.documents d
             where d.review = 'on_file' and d.expiry_date in (today + 30, today + 7) loop
    perform app.notify((select auth_user_id from public.drivers where id = doc.driver), case when doc.expiry_date = today + 30 then 'document_expiring_30' else 'document_expiring_7' end,
      'Document expiring', replace(doc.type::text, '_', ' ') || ' expires on ' || doc.expiry_date || '.', 'doc:' || doc.id || ':expiry:' || doc.expiry_date || ':' || (doc.expiry_date - today));
  end loop;
  for t in select * from public.trips where status = 'requested' and created_at < now() - wait * interval '1 minute' loop
    for a in select * from public.admins where role = 'firm_admin' and firm_id = t.firm_id or (role = 'company_admin' and app.is_company_trip(t, company_id)) loop
      perform app.notify(a.auth_user_id, 'request_waiting', 'Request waiting', 'Trip ' || t.id || ' has waited over ' || wait || ' minutes for a driver.', 'trip:' || t.id || ':waiting', t.id);
    end loop;
  end loop;
end $$;

select cron.schedule('flyt-reminders', '* * * * *', 'select app.run_reminders()');

-- Pickup estimate when the driver accepts (same rule as lib/eta.ts: 2.5 min per km + 2).
create function app.set_pickup_eta() returns trigger language plpgsql security definer set search_path = '' as $$
declare zone text := (select d.zone from public.drivers d where d.id = new.driver_id);
begin
  if new.status = 'driver_arriving' and old.status is distinct from 'driver_arriving' and zone is not null then
    new.pickup_eta_minutes := ceil(case when zone = new.pickup then 0 else coalesce(app.distance_km(zone, new.pickup), 0) end * 2.5)::integer + 2;
  end if;
  return new;
end $$;
create trigger trips_pickup_eta before update on public.trips for each row execute function app.set_pickup_eta();

alter publication supabase_realtime add table public.notifications, public.chat_messages;
