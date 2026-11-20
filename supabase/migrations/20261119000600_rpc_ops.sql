-- RPC functions for Ops, firm admins and the company portal. Same rules as the mock adapter (lib/data/mock.ts).

create function app.new_id(prefix text) returns text language sql volatile as $$
  select prefix || '-' || substr(md5(gen_random_uuid()::text), 1, 10)
$$;

create function app.normal_phone(p_phone text) returns text language plpgsql immutable as $$
declare digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
begin
  if digits like '250%' then digits := substr(digits, 4); end if;
  if digits like '0%' then digits := substr(digits, 2); end if;
  if digits !~ '^7[2389]\d{7}$' then raise exception 'Enter a valid Rwandan mobile number'; end if;
  return '+250 ' || substr(digits, 1, 3) || ' ' || substr(digits, 4, 3) || ' ' || substr(digits, 7);
end $$;

/** Document rows for a new driver or car. A type with no date is recorded as missing; the national ID has no expiry. */
create function app.add_documents(p_owner text, p_kind text, p_expiries jsonb) returns void language plpgsql security definer set search_path = '' as $$
declare
  types public.document_type[] := case when p_kind = 'driver'
    then array['driving_licence', 'national_id', 'criminal_record', 'professional_certificate']::public.document_type[]
    else array['registration', 'inspection', 'insurance']::public.document_type[] end;
  ty public.document_type;
  expiry text;
begin
  foreach ty in array types loop
    expiry := nullif(trim(coalesce(p_expiries ->> ty::text, '')), '');
    if expiry is not null and expiry !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Document dates must be real dates'; end if;
    insert into public.documents (id, driver_id, car_id, type, expiry_date, review)
    values (p_owner || '-' || ty, case when p_kind = 'driver' then p_owner end, case when p_kind = 'car' then p_owner end, ty,
            case when ty = 'national_id' then null else expiry::date end,
            case when expiry is null then 'missing' else 'on_file' end::public.document_review);
  end loop;
end $$;

-- ── Fleet ──────────────────────────────────────────────────────────────────────────────────

create function public.add_firm(p jsonb) returns public.firms language plpgsql security definer set search_path = '' as $$
declare f public.firms;
begin
  perform app.require_platform();
  if nullif(trim(p->>'name'), '') is null then raise exception 'Enter the firm name'; end if;
  if nullif(trim(p->>'ruraLicenceNo'), '') is null then raise exception 'Enter the RURA licence number'; end if;
  if trim(p->>'tin') !~ '^\d{9}$' then raise exception 'TIN must be 9 digits'; end if;
  if nullif(trim(p->>'momoMerchantCode'), '') is null or nullif(trim(p->>'airtelMerchantCode'), '') is null then raise exception 'Enter both merchant codes'; end if;
  if (p->>'feePercent')::integer not in (10, 12, 15) then raise exception 'Fee must be 10, 12 or 15%%'; end if;
  if (p ? 'hourlyRate' and (p->>'hourlyRate')::numeric <> floor((p->>'hourlyRate')::numeric)) or (p ? 'dailyRate' and (p->>'dailyRate')::numeric <> floor((p->>'dailyRate')::numeric)) then
    raise exception 'Rates must be whole Rwf amounts';
  end if;
  if exists (select 1 from public.firms where lower(rura_licence_no) = lower(trim(p->>'ruraLicenceNo'))) then raise exception 'A firm with this licence number already exists'; end if;
  insert into public.firms (id, name, type, rura_licence_no, licence_expiry, tin, momo_merchant_code, airtel_merchant_code, fee_percent, hourly_rate, daily_rate, status)
  values (app.new_id('firm'), trim(p->>'name'), (p->>'type')::public.firm_type, trim(p->>'ruraLicenceNo'), (p->>'licenceExpiry')::date, trim(p->>'tin'),
          trim(p->>'momoMerchantCode'), trim(p->>'airtelMerchantCode'), (p->>'feePercent')::integer, (p->>'hourlyRate')::integer, (p->>'dailyRate')::integer,
          coalesce(p->>'status', 'pending_licence')::public.firm_status)
  returning * into f;
  return f;
end $$;

create function public.add_driver(p jsonb) returns public.drivers language plpgsql security definer set search_path = '' as $$
declare
  d public.drivers;
  phone text := app.normal_phone(p->>'phone');
  car public.cars;
  new_id text := app.new_id('driver');
begin
  perform app.require_firm_access(p->>'firmId');
  if nullif(trim(p->>'name'), '') is null then raise exception 'Enter the driver''s name'; end if;
  if exists (select 1 from public.drivers where phone_key = app.phone_key(phone)) then raise exception 'A driver with this phone number already exists'; end if;
  if nullif(p->>'carId', '') is not null then
    select * into car from public.cars where id = p->>'carId';
    if not found or car.firm_id <> p->>'firmId' then raise exception 'Pick a car from the same firm'; end if;
    if exists (select 1 from public.drivers where car_id = car.id) then raise exception 'This car already has a driver'; end if;
  end if;
  -- New drivers start pending until Flyt Operations checks their documents.
  insert into public.drivers (id, firm_id, name, phone, zone, car_id, approval, status)
  values (new_id, p->>'firmId', trim(p->>'name'), phone, p->>'zone', nullif(p->>'carId', ''), 'pending', 'offline')
  returning * into d;
  perform app.add_documents(new_id, 'driver', coalesce(p->'documents', '{}'));
  return d;
end $$;

create function public.add_car(p jsonb) returns public.cars language plpgsql security definer set search_path = '' as $$
declare
  c public.cars;
  plate text := upper(regexp_replace(coalesce(p->>'plate', ''), '\s', '', 'g'));
  new_id text := app.new_id('car');
begin
  perform app.require_firm_access(p->>'firmId');
  if plate !~ '^R[A-Z]{2}\d{3}[A-Z]$' then raise exception 'Plate must look like RAB 123 C'; end if;
  plate := substr(plate, 1, 3) || ' ' || substr(plate, 4, 3) || ' ' || substr(plate, 7, 1);
  if exists (select 1 from public.cars where cars.plate = add_car.plate) then raise exception 'A car with this plate already exists'; end if;
  if nullif(trim(p->>'make'), '') is null or nullif(trim(p->>'model'), '') is null or nullif(trim(p->>'colour'), '') is null then raise exception 'Enter the make, model and colour'; end if;
  if (p->>'year')::integer < 2000 or (p->>'year')::integer > extract(year from now())::integer + 1 then raise exception 'Year must be between 2000 and %', extract(year from now())::integer + 1; end if;
  if (p->>'seats')::integer not between 1 and 8 then raise exception 'Seats must be 1 to 8'; end if;
  insert into public.cars (id, firm_id, plate, make, model, colour, year, seats, power, zone)
  values (new_id, p->>'firmId', plate, trim(p->>'make'), trim(p->>'model'), trim(p->>'colour'), (p->>'year')::integer, (p->>'seats')::integer, (p->>'power')::public.car_power, p->>'zone')
  returning * into c;
  perform app.add_documents(new_id, 'car', coalesce(p->'documents', '{}'));
  return c;
end $$;

/**
 * Approve: platform admins only, and never with an expired, missing or rejected document.
 * Suspend: platform admins, or the driver's own firm admin. A driver on a trip is suspended when the trip ends.
 */
create function public.set_driver_approval(p_driver text, p_approval public.driver_approval) returns public.drivers language plpgsql security definer set search_path = '' as $$
declare d public.drivers;
begin
  select * into d from public.drivers where id = p_driver for update;
  if not found then raise exception 'Driver not found'; end if;
  if p_approval = 'approved' then
    perform app.require_platform();
    if exists (select 1 from public.documents doc where doc.driver_id = d.id and app.document_blocks(doc)) then
      raise exception 'Expired, missing or rejected documents must be fixed before approval';
    end if;
    update public.drivers set approval = 'approved' where id = d.id returning * into d;
  elsif p_approval = 'suspended' then
    perform app.require_firm_access(d.firm_id);
    if d.status = 'on_trip' then
      -- Never stop a trip midway.
      update public.drivers set suspend_after_trip = true where id = d.id returning * into d;
    else
      update public.drivers set approval = 'suspended', status = 'offline' where id = d.id returning * into d;
    end if;
  else
    raise exception 'Approve or suspend';
  end if;
  return d;
end $$;

/** Platform admins approve or reject a document sent for review. A rejection needs a reason, which the driver sees. */
create function public.review_document(p_owner text, p_owner_id text, p_type public.document_type, p_decision text, p_reason text default null) returns public.documents language plpgsql security definer set search_path = '' as $$
declare doc public.documents;
begin
  perform app.require_platform();
  select * into doc from public.documents
  where type = p_type and ((p_owner = 'driver' and driver_id = p_owner_id) or (p_owner = 'car' and car_id = p_owner_id)) for update;
  if not found then raise exception 'Unknown document'; end if;
  if doc.review <> 'pending_review' then raise exception 'This document is not waiting for review'; end if;
  if p_decision = 'reject' then
    if nullif(trim(p_reason), '') is null then raise exception 'Give a reason the driver can act on'; end if;
    update public.documents set review = 'rejected', reject_reason = left(trim(p_reason), 200), updated_at = now() where id = doc.id returning * into doc;
    -- A driver who was online with a document that is now rejected goes offline.
    if p_owner = 'driver' then update public.drivers set status = 'offline' where id = p_owner_id and status = 'online'; end if;
  elsif p_decision = 'approve' then
    if p_type <> 'national_id' and doc.expiry_date < (now() at time zone 'Africa/Kigali')::date then raise exception 'This document has already expired'; end if;
    update public.documents set review = 'on_file', reject_reason = null, updated_at = now() where id = doc.id returning * into doc;
  else
    raise exception 'Approve or reject';
  end if;
  return doc;
end $$;

-- ── Companies and staff ────────────────────────────────────────────────────────────────────

create function public.add_company(p jsonb) returns public.companies language plpgsql security definer set search_path = '' as $$
declare
  c public.companies;
  code text := upper(nullif(trim(p->>'joinCode'), ''));
  word text;
begin
  perform app.require_platform();
  if nullif(trim(p->>'name'), '') is null then raise exception 'Enter the company name'; end if;
  if nullif(trim(p->>'contactName'), '') is null then raise exception 'Enter the contact person'; end if;
  if (p->>'staffCount')::numeric < 1 or (p->>'staffCount')::numeric <> floor((p->>'staffCount')::numeric) then raise exception 'Staff count must be a whole number'; end if;
  if exists (select 1 from public.companies where lower(name) = lower(trim(p->>'name'))) then raise exception 'A company with this name already exists'; end if;
  if code is null then
    word := coalesce(nullif(left(regexp_replace(upper(split_part(trim(p->>'name'), ' ', 1)), '[^A-Z]', '', 'g'), 10), ''), 'FLYT');
    loop
      code := word || '-' || (10 + floor(random() * 90))::integer;
      exit when not exists (select 1 from public.companies where lower(join_code) = lower(code));
    end loop;
  end if;
  if code !~ '^[A-Z0-9-]{4,20}$' then raise exception 'Join code: 4 to 20 letters, digits or dashes'; end if;
  if exists (select 1 from public.companies where lower(join_code) = lower(code)) then raise exception 'This join code is already used'; end if;
  insert into public.companies (id, name, contact_name, phone, staff_count, status, join_code)
  values (app.new_id('co'), trim(p->>'name'), trim(p->>'contactName'), app.normal_phone(p->>'phone'), (p->>'staffCount')::integer, coalesce(p->>'status', 'active')::public.company_status, code)
  returning * into c;
  return c;
end $$;

create function app.require_company_access(company text) returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not (app.is_platform() or app.admin_company() = company) then raise exception 'You can only manage your own company' using errcode = '42501'; end if;
end $$;

/** Links a person's rider account by phone, or creates one. They accept the Terms when they first sign in. */
create function public.add_staff(p_company text, p_name text, p_phone text) returns public.riders language plpgsql security definer set search_path = '' as $$
declare
  phone text := app.normal_phone(p_phone);
  r public.riders;
begin
  perform app.require_company_access(p_company);
  if not exists (select 1 from public.companies where id = p_company) then raise exception 'Company not found'; end if;
  select * into r from public.riders where phone_key = app.phone_key(phone) for update;
  if found then
    if r.company_id = p_company then raise exception 'This person is already on your staff list'; end if;
    if r.company_id is not null then raise exception 'This person is linked to another company'; end if;
    update public.riders set company_id = p_company where id = r.id returning * into r;
    return r;
  end if;
  if nullif(trim(p_name), '') is null then raise exception 'Enter the person''s name'; end if;
  insert into public.riders (id, name, phone, company_id) values (app.new_id('rider'), trim(p_name), phone, p_company) returning * into r;
  return r;
end $$;

create function public.remove_staff(p_company text, p_rider text) returns public.riders language plpgsql security definer set search_path = '' as $$
declare r public.riders;
begin
  perform app.require_company_access(p_company);
  update public.riders set company_id = null where id = p_rider and company_id = p_company returning * into r;
  if not found then raise exception 'This person is not on your staff list'; end if;
  update public.commute_routes set rider_ids = array_remove(rider_ids, p_rider) where company_id = p_company;
  return r;
end $$;

-- ── Team ───────────────────────────────────────────────────────────────────────────────────

create function public.add_admin(p_name text, p_phone text, p_role public.admin_role, p_firm text default null, p_company text default null) returns public.admins language plpgsql security definer set search_path = '' as $$
declare
  a public.admins;
  phone text := app.normal_phone(p_phone);
begin
  perform app.require_platform();
  if nullif(trim(p_name), '') is null then raise exception 'Enter the person''s name'; end if;
  if exists (select 1 from public.admins where phone_key = app.phone_key(phone) and role = p_role) then raise exception 'This person already has this role'; end if;
  if p_role = 'firm_admin' and not exists (select 1 from public.firms where id = p_firm) then raise exception 'Pick the firm'; end if;
  if p_role = 'company_admin' and not exists (select 1 from public.companies where id = p_company) then raise exception 'Pick the company'; end if;
  insert into public.admins (id, name, phone, role, firm_id, company_id)
  values (app.new_id('admin'), trim(p_name), phone, p_role, case when p_role = 'firm_admin' then p_firm end, case when p_role = 'company_admin' then p_company end)
  returning * into a;
  return a;
end $$;

create function public.remove_admin(p_admin text) returns void language plpgsql security definer set search_path = '' as $$
declare a public.admins;
begin
  perform app.require_platform();
  select * into a from public.admins where id = p_admin for update;
  if not found then raise exception 'Team member not found'; end if;
  if a.auth_user_id = auth.uid() then raise exception 'You cannot remove yourself'; end if;
  if a.role = 'platform_admin' and (select count(*) from public.admins where role = 'platform_admin') <= 1 then raise exception 'Keep at least one platform admin'; end if;
  delete from public.admins where id = p_admin;
end $$;

-- ── Pricing ────────────────────────────────────────────────────────────────────────────────

create function public.set_active_plan(p_name public.plan_name) returns void language plpgsql security definer set search_path = '' as $$
begin
  perform app.require_platform();
  if not exists (select 1 from public.pricing_plans where name = p_name) then raise exception 'Unknown plan'; end if;
  update public.pricing_plans set is_active = false where is_active and name <> p_name;
  update public.pricing_plans set is_active = true where name = p_name;
end $$;

create function public.update_plan(p_name public.plan_name, p_first_km integer default null, p_per_km integer default null, p_shared_seat_percent integer default null) returns void language plpgsql security definer set search_path = '' as $$
begin
  perform app.require_platform();
  if p_first_km < 0 or p_per_km < 0 then raise exception 'Prices must be whole numbers'; end if;
  if p_shared_seat_percent not between 1 and 100 then raise exception 'Shared seat must be 1 to 100%%'; end if;
  update public.pricing_plans set first_km = coalesce(p_first_km, first_km), per_km = coalesce(p_per_km, per_km), shared_seat_percent = coalesce(p_shared_seat_percent, shared_seat_percent)
  where name = p_name;
  if not found then raise exception 'Unknown plan'; end if;
end $$;

/** p_zones: [{placeId, price?}]. A zone with no price uses the private-ride formula. */
create function public.update_airport_zones(p_zones jsonb) returns void language plpgsql security definer set search_path = '' as $$
declare z jsonb;
begin
  perform app.require_platform();
  for z in select * from jsonb_array_elements(p_zones) loop
    if z ? 'price' and z->>'price' is not null and ((z->>'price')::numeric <= 0 or (z->>'price')::numeric <> floor((z->>'price')::numeric)) then
      raise exception 'Zone prices must be whole Rwf amounts';
    end if;
  end loop;
  delete from public.airport_zones;
  insert into public.airport_zones (place_id, price) select z->>'placeId', (z->>'price')::integer from jsonb_array_elements(p_zones) z;
end $$;

create function public.set_firm_fee(p_firm text, p_fee_percent integer) returns public.firms language plpgsql security definer set search_path = '' as $$
declare f public.firms;
begin
  perform app.require_platform();
  if p_fee_percent not in (10, 12, 15) then raise exception 'Fee must be 10, 12 or 15%%'; end if;
  update public.firms set fee_percent = p_fee_percent where id = p_firm returning * into f;
  if not found then raise exception 'Firm not found'; end if;
  return f;
end $$;

/** Each firm sets its own hire rates. A null rate means the firm does not offer that hire. Booked fares stay fixed. */
create function public.set_firm_rates(p_firm text, p_hourly_rate integer default null, p_daily_rate integer default null) returns public.firms language plpgsql security definer set search_path = '' as $$
declare f public.firms;
begin
  perform app.require_firm_access(p_firm);
  if p_hourly_rate <= 0 or p_daily_rate <= 0 then raise exception 'Rates must be whole Rwf amounts'; end if;
  update public.firms set hourly_rate = p_hourly_rate, daily_rate = p_daily_rate where id = p_firm returning * into f;
  if not found then raise exception 'Firm not found'; end if;
  return f;
end $$;

-- ── Incidents ──────────────────────────────────────────────────────────────────────────────

/** Notes: platform admins, or the firm admin when the incident is on their firm's trip. Status: platform admins only. */
create function public.update_incident(p_incident text, p_status public.incident_status default null, p_note text default null) returns public.incidents language plpgsql security definer set search_path = '' as $$
declare i public.incidents;
begin
  select * into i from public.incidents where id = p_incident for update;
  if not found then raise exception 'Incident not found'; end if;
  if not (app.is_platform() or exists (select 1 from public.trips t where t.id = i.trip_id and t.firm_id = app.admin_firm())) then
    raise exception 'Incident not found' using errcode = '42501';
  end if;
  if nullif(trim(p_note), '') is null and p_status is null then raise exception 'Add a note or change the status'; end if;
  if p_status is not null then perform app.require_platform(); end if;
  update public.incidents set
    notes = case when nullif(trim(p_note), '') is null then notes else notes || left(trim(p_note), 500) end,
    status = coalesce(p_status, status)
  where id = p_incident returning * into i;
  return i;
end $$;
