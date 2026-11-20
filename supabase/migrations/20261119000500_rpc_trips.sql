-- RPC functions for sign-in, booking and the trip flow. Each one checks who is calling (auth.uid()).
-- The fare, platform fee and every status move are worked out here, never taken from the screen.

-- ── Sign-in: link the signed-in phone to a rider, driver or admin ──────────────────────────────

create function app.my_phone_key() returns text language sql stable security definer set search_path = '' as $$
  select app.phone_key(phone) from auth.users where id = auth.uid()
$$;

/**
 * Called after the SMS code is checked. Links the signed-in phone to an existing rider (for example staff a company
 * added), or creates the rider. New riders and staff signing in for the first time must accept the Terms.
 */
create function public.register_rider(p_name text default null, p_consent boolean default false, p_join_code text default null)
returns public.riders language plpgsql security definer set search_path = '' as $$
declare
  key text := app.my_phone_key();
  r public.riders;
  company text;
begin
  if auth.uid() is null or key = '' then raise exception 'Sign in with your phone first'; end if;
  if nullif(trim(p_join_code), '') is not null then
    select id into company from public.companies where lower(join_code) = lower(trim(p_join_code)) and status = 'active';
    if company is null then raise exception 'That company code was not found'; end if;
  end if;
  select * into r from public.riders where phone_key = key for update;
  if found then
    if r.auth_user_id is not null and r.auth_user_id <> auth.uid() then raise exception 'This number belongs to another account'; end if;
    if r.consent_at is null and not p_consent then raise exception 'Accept the Terms and Privacy Policy to continue'; end if;
    update public.riders set auth_user_id = auth.uid(), consent_at = coalesce(consent_at, now()), company_id = coalesce(company, company_id)
    where id = r.id returning * into r;
    return r;
  end if;
  if nullif(trim(p_name), '') is null then raise exception 'Enter your name to create your account'; end if;
  if not p_consent then raise exception 'Accept the Terms and Privacy Policy to continue'; end if;
  insert into public.riders (id, auth_user_id, name, phone, company_id, consent_at)
  values ('rider-' || substr(md5(gen_random_uuid()::text), 1, 10), auth.uid(), trim(p_name),
          '+250 ' || substr(key, 1, 3) || ' ' || substr(key, 4, 3) || ' ' || substr(key, 7), company, now())
  returning * into r;
  return r;
end $$;

/** Links the signed-in phone to the driver a firm registered. */
create function public.claim_driver() returns public.drivers language plpgsql security definer set search_path = '' as $$
declare d public.drivers;
begin
  select * into d from public.drivers where phone_key = app.my_phone_key() for update;
  if not found then raise exception 'This number is not registered with a Flyt partner firm'; end if;
  if d.auth_user_id is not null and d.auth_user_id <> auth.uid() then raise exception 'This number belongs to another account'; end if;
  update public.drivers set auth_user_id = auth.uid() where id = d.id returning * into d;
  return d;
end $$;

/** Links the signed-in phone to Ops or company portal team members with that number. p_portal: 'ops' or 'company'. */
create function public.claim_admin(p_portal text) returns setof public.admins language plpgsql security definer set search_path = '' as $$
begin
  update public.admins set auth_user_id = auth.uid()
  where phone_key = app.my_phone_key() and auth_user_id is null
    and ((p_portal = 'ops' and role in ('platform_admin', 'firm_admin')) or (p_portal = 'company' and role = 'company_admin'));
  return query select * from public.admins where auth_user_id = auth.uid()
    and ((p_portal = 'ops' and role in ('platform_admin', 'firm_admin')) or (p_portal = 'company' and role = 'company_admin'));
  if not found then raise exception 'This number has no access here' using errcode = '42501'; end if;
end $$;

create function public.update_rider_profile(p_name text default null, p_language public.language default null, p_saved_places jsonb default null, p_emergency_contacts jsonb default null)
returns public.riders language plpgsql security definer set search_path = '' as $$
declare r public.riders;
begin
  if app.rider_id() is null then raise exception 'Sign in first'; end if;
  if p_name is not null and trim(p_name) = '' then raise exception 'Enter your name'; end if;
  if p_saved_places is not null and jsonb_typeof(p_saved_places) <> 'array' then raise exception 'Saved places must be a list'; end if;
  if p_emergency_contacts is not null and jsonb_typeof(p_emergency_contacts) <> 'array' then raise exception 'Emergency contacts must be a list'; end if;
  update public.riders set
    name = coalesce(trim(p_name), name),
    language = coalesce(p_language, language),
    saved_places = coalesce(p_saved_places, saved_places),
    emergency_contacts = coalesce(p_emergency_contacts, emergency_contacts)
  where id = app.rider_id() returning * into r;
  return r;
end $$;

-- ── Quotes and booking ──────────────────────────────────────────────────────────────────────

/** An active firm that offers the ride type, preferring one with a free driver (same as pickFirm in the mock). */
create function app.pick_firm(p_type public.trip_type) returns text language sql stable security definer set search_path = '' as $$
  select f.id from public.firms f
  where f.status = 'active'
    and (p_type <> 'hourly' or f.hourly_rate is not null)
    and (p_type <> 'daily' or f.daily_rate is not null)
  order by exists (select 1 from public.drivers d where d.firm_id = f.id and d.approval = 'approved' and d.status = 'online') desc, f.id
  limit 1
$$;

create function public.quote_trip(p_type public.trip_type, p_pickup text, p_dropoff text, p_hire_quantity integer default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare firm text := app.pick_firm(p_type);
begin
  if firm is null then raise exception 'No licensed partner offers this ride type right now'; end if;
  return public.fare_quote(p_type, p_pickup, p_dropoff, p_hire_quantity, firm) || jsonb_build_object('firmId', firm);
end $$;

/** Minutes until the nearest free car could reach the pickup, per ride type (lib/eta.ts: 2.5 min per km + 2). Riders never see where drivers are. */
create function public.pickup_etas(p_pickup text, p_types public.trip_type[]) returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(type, minutes), '{}') from (
    select t.type, min(ceil(case when d.zone = p_pickup then 0 else app.distance_km(d.zone, p_pickup) end * 2.5)::integer + 2) as minutes
    from unnest(p_types) as t(type)
    join public.firms f on f.status = 'active' and (t.type <> 'hourly' or f.hourly_rate is not null) and (t.type <> 'daily' or f.daily_rate is not null)
    join public.drivers d on d.firm_id = f.id and d.approval = 'approved' and d.status = 'online'
    join public.cars c on c.id = d.car_id and c.availability = 'available'
    group by t.type
  ) etas
$$;

create function public.create_booking(p_pickup text, p_dropoff text, p_type public.trip_type, p_payment_method public.payment_method, p_hire_quantity integer default null, p_scheduled_for timestamptz default null)
returns public.trips language plpgsql security definer set search_path = '' as $$
declare
  r public.riders;
  q jsonb;
  firm public.firms;
  pay public.payment_method := case when p_type = 'shared_commute' then 'company_account' else p_payment_method end;
  route text;
  t public.trips;
  hire boolean := p_type in ('hourly', 'daily');
begin
  select * into r from public.riders where id = app.rider_id();
  if not found then raise exception 'Sign in first'; end if;
  if p_pickup = p_dropoff and not hire then raise exception 'Choose different pickup and drop-off places'; end if;
  if (p_type = 'shared_commute' or p_payment_method = 'company_account') and r.company_id is null then raise exception 'Only company staff can book this'; end if;
  if p_scheduled_for is not null and p_scheduled_for < now() then raise exception 'Pick a time in the future'; end if;
  q := public.quote_trip(p_type, p_pickup, p_dropoff, case when hire then coalesce(p_hire_quantity, 1) end);
  select * into firm from public.firms where id = q->>'firmId';
  if p_type = 'shared_commute' then
    select id into route from public.commute_routes where company_id = r.company_id and p_pickup = any (stops) and p_dropoff = any (stops) order by id limit 1;
  end if;
  insert into public.trips (type, rider_id, company_id, firm_id, pickup, dropoff, distance_km, hire_quantity, scheduled_for, fare, platform_fee, plan_name, status, payment_method, payment_status, commute_route_id)
  values (p_type, r.id, case when pay = 'company_account' then r.company_id end, firm.id, p_pickup, p_dropoff, (q->>'distanceKm')::numeric,
          case when hire then coalesce(p_hire_quantity, 1) end, p_scheduled_for, (q->>'fare')::integer, public.platform_fee((q->>'fare')::integer, firm.fee_percent),
          (q->>'planName')::public.plan_name, case when p_scheduled_for is null then 'requested' else 'scheduled' end::public.trip_status, pay,
          case when pay = 'company_account' then 'billed_to_company' else 'pending' end::public.payment_status, route)
  returning * into t;
  return t;
end $$;

-- ── Dispatch and offers ─────────────────────────────────────────────────────────────────────

/** Free the driver and car of a trip. A driver suspended during the trip is suspended now. */
create function app.release(t public.trips) returns void language plpgsql security definer set search_path = '' as $$
begin
  if t.driver_id is null then return; end if;
  update public.drivers set
    status = case when suspend_after_trip then 'offline' when status = 'on_trip' then 'online' else status end,
    approval = case when suspend_after_trip then 'suspended' else approval end,
    suspend_after_trip = false
  where id = t.driver_id;
  update public.cars set availability = 'available' where id = t.car_id and availability = 'in_use';
end $$;

/** Expire pending offers whose 20 seconds have passed; their trips go back to the Dispatch queue. Safe to call often. */
create function public.expire_offers() returns integer language plpgsql security definer set search_path = '' as $$
declare
  o public.job_offers;
  t public.trips;
  n integer := 0;
begin
  for o in select * from public.job_offers where status = 'pending' and expires_at <= now() for update skip locked loop
    update public.job_offers set status = 'expired' where id = o.id;
    select * into t from public.trips where id = o.trip_id for update;
    if t.status = 'assigned' and t.driver_id = o.driver_id then
      perform app.release(t);
      perform app.move_trip(t.id, 'requested');
      update public.trips set driver_id = null, car_id = null, assigned_at = null where id = t.id;
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;

/** Attach a driver (and their car) to a trip and send a 20-second offer. Hire trips stay with the booked firm. */
create function app.attach(p_trip text, p_driver text) returns void language plpgsql security definer set search_path = '' as $$
declare
  t public.trips;
  d public.drivers;
  c public.cars;
  f public.firms;
begin
  select * into t from public.trips where id = p_trip for update;
  select * into d from public.drivers where id = p_driver for update;
  if not found then raise exception 'Driver not found'; end if;
  if d.approval <> 'approved' then raise exception 'This driver is not approved'; end if;
  if d.status <> 'online' then raise exception 'This driver is not online'; end if;
  select * into c from public.cars where id = d.car_id for update;
  if not found then raise exception 'This driver has no car'; end if;
  if c.availability <> 'available' then raise exception 'This driver''s car is not available'; end if;
  select * into f from public.firms where id = d.firm_id;
  if f.status <> 'active' then raise exception 'This driver''s firm is not active'; end if;
  if t.type in ('hourly', 'daily') and d.firm_id <> t.firm_id then raise exception 'Hire trips must stay with the booked firm'; end if;
  -- The fare is fixed at booking; only the platform fee follows the new firm's rate.
  update public.trips set driver_id = d.id, car_id = c.id, assigned_at = now(),
    firm_id = f.id, platform_fee = case when firm_id <> f.id then public.platform_fee(fare, f.fee_percent) else platform_fee end
  where id = t.id;
  update public.drivers set status = 'on_trip' where id = d.id;
  update public.cars set availability = 'in_use' where id = c.id;
  insert into public.job_offers (trip_id, driver_id, expires_at) values (t.id, d.id, now() + interval '20 seconds');
end $$;

/** Ops dispatch: platform admins, or a firm admin for their own firm's trip and driver. */
create function app.require_dispatch(p_trip text, p_driver text) returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if app.is_platform() then return; end if;
  if app.admin_firm() is not null
     and (select firm_id from public.trips where id = p_trip) = app.admin_firm()
     and (select firm_id from public.drivers where id = p_driver) = app.admin_firm() then return; end if;
  raise exception 'You can only dispatch your own firm''s trips and drivers' using errcode = '42501';
end $$;

create function public.assign_driver(p_trip text, p_driver text) returns public.trips language plpgsql security definer set search_path = '' as $$
declare t public.trips;
begin
  perform public.expire_offers();
  perform app.require_dispatch(p_trip, p_driver);
  select * into t from public.trips where id = p_trip;
  if not found then raise exception 'Trip not found'; end if;
  if not exists (select 1 from app.trip_transitions where from_status = t.status and to_status = 'assigned') then
    raise exception 'A trip cannot move from % to assigned', t.status;
  end if;
  perform app.attach(p_trip, p_driver);
  return app.move_trip(p_trip, 'assigned');
end $$;

create function public.reassign_driver(p_trip text, p_driver text) returns public.trips language plpgsql security definer set search_path = '' as $$
declare t public.trips;
begin
  perform app.require_dispatch(p_trip, p_driver);
  select * into t from public.trips where id = p_trip for update;
  if not found then raise exception 'Trip not found'; end if;
  if t.status not in ('assigned', 'driver_arriving') then raise exception 'This trip can no longer be reassigned'; end if;
  if t.driver_id = p_driver then raise exception 'This driver already has the trip'; end if;
  update public.job_offers set status = 'expired' where trip_id = t.id and status = 'pending';
  perform app.release(t);
  -- Back to assigned for the new driver, who gets a fresh offer.
  update public.trips set status = 'assigned', accepted_at = null, updated_at = now() where id = t.id;
  perform app.attach(p_trip, p_driver);
  select * into t from public.trips where id = p_trip;
  return t;
end $$;

create function public.respond_offer(p_offer text, p_accept boolean) returns public.trips language plpgsql security definer set search_path = '' as $$
declare
  o public.job_offers;
  t public.trips;
begin
  select * into o from public.job_offers where id = p_offer for update;
  if not found or o.driver_id is distinct from app.driver_id() then raise exception 'Offer not found'; end if;
  if o.status <> 'pending' or o.expires_at <= now() then
    perform public.expire_offers();
    raise exception 'This offer has expired';
  end if;
  if p_accept then
    t := app.move_trip(o.trip_id, 'driver_arriving');
    update public.job_offers set status = 'accepted' where id = o.id;
  else
    update public.job_offers set status = 'declined' where id = o.id;
    select * into t from public.trips where id = o.trip_id;
    perform app.release(t);
    perform app.move_trip(t.id, 'requested');
    update public.trips set driver_id = null, car_id = null, assigned_at = null where id = t.id returning * into t;
  end if;
  return t;
end $$;

-- ── Driver steps ───────────────────────────────────────────────────────────────────────────

create function app.require_trip_driver(p_trip text) returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.trips where id = p_trip and driver_id = app.driver_id()) then
    raise exception 'This is not your trip' using errcode = '42501';
  end if;
end $$;

create function public.driver_arrived(p_trip text) returns public.trips language plpgsql security definer set search_path = '' as $$
begin
  perform app.require_trip_driver(p_trip);
  return app.move_trip(p_trip, 'driver_arrived');
end $$;

create function public.start_trip(p_trip text) returns public.trips language plpgsql security definer set search_path = '' as $$
begin
  perform app.require_trip_driver(p_trip);
  return app.move_trip(p_trip, 'in_progress');
end $$;

create function public.end_trip(p_trip text) returns public.trips language plpgsql security definer set search_path = '' as $$
declare t public.trips;
begin
  perform app.require_trip_driver(p_trip);
  t := app.move_trip(p_trip, 'completed');
  -- Demo EBM receipt number. In production the firm's EBM system issues it.
  update public.trips set receipt_no = 'EBM-' || to_char(now() at time zone 'Africa/Kigali', 'YYYY') || '-' || (10000 + floor(random() * 89999))::integer
  where id = p_trip returning * into t;
  perform app.release(t);
  return t;
end $$;

/** Cancel with a reason. Who cancels is worked out from the caller: the rider, the driver, or Ops (on the rider's behalf). */
create function public.cancel_trip(p_trip text, p_reason text) returns public.trips language plpgsql security definer set search_path = '' as $$
declare
  t public.trips;
  who public.cancelled_by;
begin
  if nullif(trim(p_reason), '') is null then raise exception 'Choose a reason'; end if;
  select * into t from public.trips where id = p_trip;
  if not found then raise exception 'Trip not found'; end if;
  who := case
    when t.rider_id = app.rider_id() then 'rider'
    when t.driver_id is not null and t.driver_id = app.driver_id() then 'driver'
    when app.is_platform() or t.firm_id = app.admin_firm() then 'ops'
  end;
  if who is null then raise exception 'This is not your trip' using errcode = '42501'; end if;
  t := app.move_trip(p_trip, case when who = 'driver' then 'cancelled_by_driver' else 'cancelled_by_rider' end::public.trip_status);
  update public.job_offers set status = 'expired' where trip_id = t.id and status = 'pending';
  perform app.release(t);
  update public.trips set cancelled_by = who, cancel_reason = left(trim(p_reason), 200) where id = p_trip returning * into t;
  return t;
end $$;

create function public.mark_no_driver_found(p_trip text) returns public.trips language plpgsql security definer set search_path = '' as $$
declare t public.trips;
begin
  select * into t from public.trips where id = p_trip;
  if not found then raise exception 'Trip not found'; end if;
  perform app.require_firm_access(t.firm_id);
  t := app.move_trip(p_trip, 'no_driver_found');
  update public.trips set cancelled_by = 'system', cancel_reason = 'No driver accepted' where id = p_trip returning * into t;
  return t;
end $$;

-- ── Payment and ratings ────────────────────────────────────────────────────────────────────

create function public.rider_mark_paid(p_trip text) returns public.trips language plpgsql security definer set search_path = '' as $$
declare t public.trips;
begin
  select * into t from public.trips where id = p_trip and rider_id = app.rider_id() for update;
  if not found then raise exception 'Trip not found'; end if;
  if t.status <> 'completed' then raise exception 'Pay after the trip ends'; end if;
  if t.payment_method = 'company_account' then raise exception 'This trip is billed to your company'; end if;
  if t.payment_status = 'paid' then return t; end if;
  update public.trips set rider_paid_at = now(), payment_status = 'pending', updated_at = now() where id = p_trip returning * into t;
  return t;
end $$;

/** The driver (or their firm admin, or Flyt Operations) confirms the money arrived in the firm's MoMo or Airtel account. */
create function public.confirm_payment(p_trip text, p_received boolean) returns public.trips language plpgsql security definer set search_path = '' as $$
declare t public.trips;
begin
  select * into t from public.trips where id = p_trip for update;
  if not found then raise exception 'Trip not found'; end if;
  if not (t.driver_id = app.driver_id() or app.is_platform() or t.firm_id = app.admin_firm()) then raise exception 'This is not your trip' using errcode = '42501'; end if;
  if t.status <> 'completed' or t.payment_method = 'company_account' then raise exception 'Nothing to confirm for this trip'; end if;
  update public.trips set payment_status = case when p_received then 'paid' else 'failed' end::public.payment_status,
    paid_at = case when p_received then now() end, updated_at = now()
  where id = p_trip returning * into t;
  return t;
end $$;

create function public.rate_trip(p_trip text, p_rating integer, p_tags text[] default null, p_comment text default null) returns public.trips language plpgsql security definer set search_path = '' as $$
declare t public.trips;
begin
  if p_rating is null or p_rating < 1 or p_rating > 5 then raise exception 'Rating must be 1 to 5 stars'; end if;
  select * into t from public.trips where id = p_trip and rider_id = app.rider_id() for update;
  if not found then raise exception 'Trip not found'; end if;
  if t.status <> 'completed' then raise exception 'Rate after the trip ends'; end if;
  update public.trips set rider_rating = p_rating, rating_tags = nullif(p_tags, '{}'), rating_comment = nullif(left(trim(p_comment), 500), '')
  where id = p_trip returning * into t;
  return t;
end $$;

create function public.rate_rider(p_trip text, p_rating integer) returns public.trips language plpgsql security definer set search_path = '' as $$
declare t public.trips;
begin
  if p_rating is null or p_rating < 1 or p_rating > 5 then raise exception 'Rating must be 1 to 5 stars'; end if;
  select * into t from public.trips where id = p_trip and driver_id = app.driver_id() for update;
  if not found then raise exception 'Trip not found'; end if;
  if t.status <> 'completed' then raise exception 'Rate after the trip ends'; end if;
  update public.trips set driver_rating = p_rating where id = p_trip returning * into t;
  return t;
end $$;

-- ── What a driver sees about a rider (rule c) ──────────────────────────────────────────────

/**
 * A trip as the driver sees it: the rider's first name, their rating from drivers and trip count,
 * and their phone only while the trip is active (assigned to the end of the trip).
 */
create function public.driver_job(p_trip text) returns jsonb language plpgsql stable security definer set search_path = '' as $$
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
    'tripCount', (select count(*) from public.trips where rider_id = t.rider_id and status = 'completed')
  );
end $$;

create function public.set_driver_presence(p_presence public.driver_presence) returns public.drivers language plpgsql security definer set search_path = '' as $$
declare d public.drivers;
begin
  select * into d from public.drivers where id = app.driver_id() for update;
  if not found then raise exception 'Sign in first'; end if;
  if p_presence = 'on_trip' then raise exception 'Presence must be online or offline'; end if;
  if d.status = 'on_trip' then raise exception 'Finish the current trip first'; end if;
  if p_presence = 'online' and d.approval <> 'approved' then raise exception 'Your account is not approved yet'; end if;
  if p_presence = 'online' and exists (select 1 from public.documents doc where doc.driver_id = d.id and app.document_blocks(doc)) then
    raise exception 'A document is expired, missing or rejected. Send a new one before going online';
  end if;
  update public.drivers set status = p_presence where id = d.id returning * into d;
  return d;
end $$;

/** A driver sends a new document for review. p_file_path is the object they uploaded to the private documents bucket. */
create function public.submit_document(p_type public.document_type, p_expiry date default null, p_file_path text default null) returns public.documents language plpgsql security definer set search_path = '' as $$
declare
  me text := app.driver_id();
  doc public.documents;
begin
  if me is null then raise exception 'Sign in first'; end if;
  select * into doc from public.documents where driver_id = me and type = p_type for update;
  if not found then raise exception 'Unknown document'; end if;
  if p_type <> 'national_id' and p_expiry is null then raise exception 'Enter the expiry date'; end if;
  if p_type <> 'national_id' and p_expiry < (now() at time zone 'Africa/Kigali')::date then raise exception 'This document has already expired'; end if;
  if p_file_path is not null and split_part(p_file_path, '/', 1) <> me then raise exception 'Upload the file to your own folder'; end if;
  update public.documents set review = 'pending_review', reject_reason = null,
    expiry_date = case when p_type = 'national_id' then expiry_date else p_expiry end,
    file_path = coalesce(p_file_path, file_path), updated_at = now()
  where id = doc.id returning * into doc;
  return doc;
end $$;

create function public.report_incident(p_type public.incident_type, p_description text, p_trip text default null) returns public.incidents language plpgsql security definer set search_path = '' as $$
declare
  i public.incidents;
  t public.trips;
  who text;
begin
  if nullif(trim(p_description), '') is null then raise exception 'Describe what happened'; end if;
  if p_trip is not null then
    select * into t from public.trips where id = p_trip;
    if not found then raise exception 'Trip not found'; end if;
    who := case when t.rider_id = app.rider_id() then 'rider' when t.driver_id = app.driver_id() then 'driver' when app.is_platform() or t.firm_id = app.admin_firm() then 'ops' end;
  else
    who := case when app.is_platform() then 'ops' end;
  end if;
  if who is null then raise exception 'This is not your trip' using errcode = '42501'; end if;
  insert into public.incidents (trip_id, type, description, reported_by) values (p_trip, p_type, left(trim(p_description), 1000), who) returning * into i;
  return i;
end $$;
