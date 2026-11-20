-- Lionel's Phase 6 decisions (2026-11-20).
--  * Tips: drivers opt in. The rider sees the driver's MoMo number only on the tip screen of a completed trip,
--    for 24 hours after it ends. Tips are capped at Rwf 10,000 (the rider confirms in the app first).
--  * Dispatch: the open queue (requested and scheduled trips with no driver) is for platform admins only.
--    A firm admin can only reassign a trip already given to their firm (its driver is one of theirs),
--    and only to their own drivers.

-- ── Tips ────────────────────────────────────────────────────────────────────────────────

alter table public.tips drop constraint tips_amount_check;
alter table public.tips add constraint tips_amount_check check (amount between 1 and 10000);

alter table public.drivers add column tips_opt_in boolean not null default false;

drop function public.set_tip_number(text);

/** The driver opts in to tips (with their own MoMo number) or opts out. */
create function public.set_tip_settings(p_opt_in boolean, p_number text default null) returns public.drivers language plpgsql security definer set search_path = '' as $$
declare
  d public.drivers;
  v_phone text := nullif(trim(coalesce(p_number, '')), '');
begin
  if app.driver_id() is null then raise exception 'Sign in first'; end if;
  if v_phone is not null then
    v_phone := app.normal_phone(v_phone);
  end if;
  if p_opt_in and v_phone is null then raise exception 'Add the MoMo number tips should go to'; end if;
  update public.drivers set tips_opt_in = p_opt_in, tip_momo_number = coalesce(v_phone, tip_momo_number)
  where id = app.driver_id() returning * into d;
  return d;
end $$;

/**
 * The MoMo number a rider can tip the driver on: only that rider, only for a completed trip, only within
 * 24 hours of the end of the trip, only when the firm allows tips and the driver opted in.
 * Flyt never holds or moves the money.
 */
create or replace function public.tip_details(p_trip text) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  t public.trips;
  d public.drivers;
begin
  select * into t from public.trips where id = p_trip and rider_id = app.rider_id();
  if not found or t.status <> 'completed' or t.completed_at is null or t.completed_at < now() - interval '24 hours' then return null; end if;
  select * into d from public.drivers where id = t.driver_id;
  if not d.tips_opt_in or d.tip_momo_number is null or not (select tips_enabled from public.firms where id = d.firm_id) then return null; end if;
  return jsonb_build_object('driverFirstName', split_part(d.name, ' ', 1), 'momoNumber', d.tip_momo_number, 'until', t.completed_at + interval '24 hours',
    'alreadyTipped', exists (select 1 from public.tips where trip_id = t.id));
end $$;

create or replace function public.record_tip(p_trip text, p_amount integer) returns public.tips language plpgsql security definer set search_path = '' as $$
declare
  t public.trips;
  x public.tips;
begin
  if public.tip_details(p_trip) is null then raise exception 'Tips are not available for this trip'; end if;
  if p_amount is null or p_amount < 1 or p_amount > 10000 then raise exception 'A tip is from Rwf 1 to Rwf 10,000'; end if;
  if exists (select 1 from public.tips where trip_id = p_trip) then raise exception 'You already tipped on this trip'; end if;
  select * into t from public.trips where id = p_trip;
  insert into public.tips (trip_id, rider_id, driver_id, amount) values (t.id, t.rider_id, t.driver_id, p_amount) returning * into x;
  return x;
end $$;

-- The driver's tip number is only for the tip screen: other people never read it from the drivers table.
-- (Riders cannot read drivers at all; firm admins and platform admins can, which is their own staff record.)

-- ── Dispatch scope ──────────────────────────────────────────────────────────────────────

create or replace function app.require_dispatch(p_trip text, p_driver text) returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if app.is_platform() then return; end if;
  if app.admin_firm() is not null
     -- Already given to the firm: the trip's current driver is one of the firm's drivers.
     and (select d.firm_id from public.trips t join public.drivers d on d.id = t.driver_id where t.id = p_trip) = app.admin_firm()
     and (select firm_id from public.drivers where id = p_driver) = app.admin_firm() then return; end if;
  raise exception 'The open queue is for Flyt Operations. You can reassign trips already given to your firm, to your own drivers' using errcode = '42501';
end $$;

revoke execute on function public.set_tip_settings from public, anon;
grant execute on function public.set_tip_settings to authenticated;
