-- Fare engine and trip status rules. These mirror lib/pricing.ts and lib/trip-rules.ts;
-- tests/db/fare-parity.test.ts proves the fares match for every audit case.
-- Amounts are whole Rwf. round() on numeric rounds half away from zero, the same as Math.round for positive amounts.

create function app.distance_km(a text, b text) returns numeric language sql stable set search_path = '' as $$
  select km from public.place_distances where (from_place = a and to_place = b) or (from_place = b and to_place = a)
$$;

/** Trip distance: 0 for hire that starts and ends at the same place. */
create function app.trip_distance(p_type public.trip_type, p_pickup text, p_dropoff text) returns numeric language plpgsql stable set search_path = '' as $$
declare km numeric;
begin
  if p_type in ('hourly', 'daily') and p_pickup = p_dropoff then return 0; end if;
  if p_pickup = p_dropoff then raise exception 'Pickup and drop-off must be different places'; end if;
  km := app.distance_km(p_pickup, p_dropoff);
  if km is null then raise exception 'No distance for % to %', p_pickup, p_dropoff; end if;
  return km;
end $$;

/** Private-ride fare: first km, then the per-km price. Trips under 1 km pay the first-km price. */
create function public.distance_fare(p_km numeric, p_first_km integer, p_per_km integer) returns integer language sql immutable as $$
  select round(p_first_km + (greatest(1, p_km) - 1) * p_per_km)::integer
$$;

/** One seat on a shared commute: a share of the private fare for the same distance. */
create function public.shared_seat_fare(p_km numeric, p_first_km integer, p_per_km integer, p_percent integer) returns integer language sql immutable as $$
  select round(public.distance_fare(p_km, p_first_km, p_per_km) * p_percent / 100.0)::integer
$$;

/** Flyt Ltd's platform fee on a fare. */
create function public.platform_fee(p_fare integer, p_percent integer) returns integer language sql immutable as $$
  select round(p_fare * p_percent / 100.0)::integer
$$;

/**
 * Fare for a ride with the active plan. p_firm is needed for hourly and daily hire (the firm's own rates).
 * Returns {fare, distanceKm, planName, rule}. Same rules as quoteFare() in lib/pricing.ts.
 */
create function public.fare_quote(p_type public.trip_type, p_pickup text, p_dropoff text, p_hire_quantity integer default null, p_firm text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  plan public.pricing_plans;
  km numeric;
  other text;
  zone_price integer;
  qty integer := coalesce(p_hire_quantity, 1);
  rate integer;
  fare integer;
  rule text;
begin
  select * into plan from public.pricing_plans where is_active;
  if not found then raise exception 'No active price plan'; end if;
  km := app.trip_distance(p_type, p_pickup, p_dropoff);
  case p_type
    when 'private' then fare := public.distance_fare(km, plan.first_km, plan.per_km); rule := 'distance';
    when 'shared_commute' then fare := public.shared_seat_fare(km, plan.first_km, plan.per_km, plan.shared_seat_percent); rule := 'shared_seat';
    when 'airport' then
      other := case when p_pickup = 'airport' then p_dropoff when p_dropoff = 'airport' then p_pickup end;
      if other is null then raise exception 'Airport transfers must start or end at Kigali International Airport'; end if;
      select price into zone_price from public.airport_zones where place_id = other;
      if zone_price is not null then fare := zone_price; rule := 'airport_zone';
      else fare := public.distance_fare(km, plan.first_km, plan.per_km); rule := 'airport_fallback'; end if;
    else
      if qty < 1 then raise exception 'Hire length must be a whole number of hours or days'; end if;
      select case when p_type = 'hourly' then hourly_rate else daily_rate end into rate from public.firms where id = p_firm;
      if rate is null then raise exception 'This firm has no % rate', p_type; end if;
      fare := rate * qty; rule := p_type::text;
  end case;
  return jsonb_build_object('fare', fare, 'distanceKm', km, 'planName', plan.name, 'rule', rule);
end $$;
grant execute on function public.fare_quote, public.distance_fare, public.shared_seat_fare, public.platform_fee to anon, authenticated;

-- Allowed trip status moves (lib/trip-rules.ts). Every status change goes through app.move_trip().
create table app.trip_transitions (
  from_status public.trip_status not null,
  to_status public.trip_status not null,
  primary key (from_status, to_status)
);
insert into app.trip_transitions values
  ('requested', 'assigned'), ('requested', 'cancelled_by_rider'), ('requested', 'no_driver_found'),
  ('scheduled', 'assigned'), ('scheduled', 'cancelled_by_rider'), ('scheduled', 'no_driver_found'),
  ('assigned', 'driver_arriving'), ('assigned', 'requested'), ('assigned', 'cancelled_by_rider'), ('assigned', 'cancelled_by_driver'),
  ('driver_arriving', 'driver_arrived'), ('driver_arriving', 'cancelled_by_rider'), ('driver_arriving', 'cancelled_by_driver'),
  ('driver_arrived', 'in_progress'), ('driver_arrived', 'cancelled_by_rider'), ('driver_arrived', 'cancelled_by_driver'),
  ('in_progress', 'completed');

/** Check a status move is allowed, then make it and write the timeline timestamp. */
create function app.move_trip(p_trip text, p_to public.trip_status) returns public.trips language plpgsql security definer set search_path = '' as $$
declare
  t public.trips;
begin
  select * into t from public.trips where id = p_trip for update;
  if not found then raise exception 'Trip not found'; end if;
  if not exists (select 1 from app.trip_transitions where from_status = t.status and to_status = p_to) then
    raise exception 'A trip cannot move from % to %', t.status, p_to using errcode = 'P0001';
  end if;
  update public.trips set
    status = p_to,
    updated_at = now(),
    accepted_at = case when p_to = 'driver_arriving' then now() else accepted_at end,
    arrived_at = case when p_to = 'driver_arrived' then now() else arrived_at end,
    started_at = case when p_to = 'in_progress' then now() else started_at end,
    completed_at = case when p_to = 'completed' then now() else completed_at end,
    cancelled_at = case when p_to in ('cancelled_by_rider', 'cancelled_by_driver', 'no_driver_found') then now() else cancelled_at end
  where id = p_trip returning * into t;
  return t;
end $$;

/** True when a document blocks work: missing, rejected, or expired (Kigali date). The national ID has no expiry. */
create function app.document_blocks(d public.documents) returns boolean language sql stable as $$
  select d.review in ('missing', 'rejected')
    or (d.review = 'on_file' and d.expiry_date is not null and d.expiry_date < (now() at time zone 'Africa/Kigali')::date)
$$;

create function app.kigali_month(t timestamptz) returns text language sql immutable as $$
  select to_char(t at time zone 'Africa/Kigali', 'YYYY-MM')
$$;
