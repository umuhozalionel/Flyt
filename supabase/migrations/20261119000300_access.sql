-- Who is signed in, and what each role may read (RLS). Writes go only through RPC functions.
--
-- Roles (one person can hold several, e.g. a rider who is also a firm admin):
--   rider          riders.auth_user_id = auth.uid()
--   driver         drivers.auth_user_id = auth.uid()
--   platform admin admins.role = 'platform_admin'   sees everything
--   firm admin     admins.role = 'firm_admin'       sees their firm's drivers, cars, documents, trips, offers, sent invoices
--   company admin  admins.role = 'company_admin'    sees their staff, company-billed trips and shared seats only (rule b)
-- A driver never reads the riders table. They get the rider's first name, and the phone only while
-- the trip is active, through driver_job() (rule c).

create function app.rider_id() returns text language sql stable security definer set search_path = '' as $$
  select id from public.riders where auth_user_id = auth.uid()
$$;

create function app.driver_id() returns text language sql stable security definer set search_path = '' as $$
  select id from public.drivers where auth_user_id = auth.uid()
$$;

create function app.is_platform() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where auth_user_id = auth.uid() and role = 'platform_admin')
$$;

create function app.admin_firm() returns text language sql stable security definer set search_path = '' as $$
  select firm_id from public.admins where auth_user_id = auth.uid() and role = 'firm_admin'
$$;

create function app.admin_company() returns text language sql stable security definer set search_path = '' as $$
  select company_id from public.admins where auth_user_id = auth.uid() and role = 'company_admin'
$$;

create function app.admin_id() returns text language sql stable security definer set search_path = '' as $$
  select id from public.admins where auth_user_id = auth.uid()
  order by case role when 'platform_admin' then 0 when 'firm_admin' then 1 else 2 end limit 1
$$;

/** Rule b: a company sees only trips billed to it and shared commute seats, never staff's own MoMo or Airtel rides. */
create function app.is_company_trip(t public.trips, company text) returns boolean language sql immutable as $$
  select company is not null and t.company_id = company and (t.payment_method = 'company_account' or t.type = 'shared_commute')
$$;

create function app.require_platform() returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not app.is_platform() then raise exception 'Only platform admins can do this' using errcode = '42501'; end if;
end $$;

/** Platform admins, or the firm admin of this firm. */
create function app.require_firm_access(firm text) returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not (app.is_platform() or app.admin_firm() = firm) then raise exception 'You can only manage your own firm' using errcode = '42501'; end if;
end $$;

-- Lock every table down: no direct writes from the app, reads only through the policies below.
do $$
declare t text;
begin
  foreach t in array array['places','place_distances','firms','companies','riders','cars','drivers','documents','pricing_plans','airport_zones','commute_routes','trips','job_offers','fee_invoices','company_invoices','incidents','admins'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;
grant select on public.places, public.place_distances, public.pricing_plans, public.airport_zones to anon;
grant usage on schema app to authenticated, anon;
grant execute on all functions in schema app to authenticated, anon;

-- Reference data and prices: anyone may read (the landing page shows prices before sign-in).
create policy "places readable" on public.places for select using (true);
create policy "distances readable" on public.place_distances for select using (true);
create policy "plans readable" on public.pricing_plans for select using (true);
create policy "zones readable" on public.airport_zones for select using (true);

-- Firms are partner businesses: riders see the firm on their receipt (name, licence, TIN, merchant codes).
create policy "firms readable when signed in" on public.firms for select to authenticated using (true);

create policy "companies" on public.companies for select to authenticated using (
  app.is_platform()
  or id = app.admin_company()
  or id = (select company_id from public.riders where id = app.rider_id())
  or exists (select 1 from public.trips t where t.company_id = companies.id and t.firm_id = app.admin_firm())
);

create policy "riders" on public.riders for select to authenticated using (
  app.is_platform()
  or auth_user_id = auth.uid()
  or (company_id is not null and company_id = app.admin_company())
  or exists (select 1 from public.trips t where t.rider_id = riders.id and t.firm_id = app.admin_firm())
);

create policy "drivers" on public.drivers for select to authenticated using (
  app.is_platform()
  or firm_id = app.admin_firm()
  or auth_user_id = auth.uid()
  or exists (select 1 from public.trips t where t.driver_id = drivers.id and (t.rider_id = app.rider_id() or app.is_company_trip(t, app.admin_company())))
);

create policy "cars" on public.cars for select to authenticated using (
  app.is_platform()
  or firm_id = app.admin_firm()
  or id = (select car_id from public.drivers where id = app.driver_id())
  or exists (select 1 from public.trips t where t.car_id = cars.id and (t.rider_id = app.rider_id() or t.driver_id = app.driver_id() or app.is_company_trip(t, app.admin_company())))
);

-- Documents (ID, criminal record certificate...) are sensitive: the driver, their firm admin and platform admins only.
create policy "documents" on public.documents for select to authenticated using (
  app.is_platform()
  or driver_id = app.driver_id()
  or car_id = (select car_id from public.drivers where id = app.driver_id())
  or exists (select 1 from public.drivers d where d.id = documents.driver_id and d.firm_id = app.admin_firm())
  or exists (select 1 from public.cars c where c.id = documents.car_id and c.firm_id = app.admin_firm())
);

create policy "commute routes" on public.commute_routes for select to authenticated using (
  app.is_platform()
  or company_id = app.admin_company()
  or company_id = (select company_id from public.riders where id = app.rider_id())
);

create policy "trips" on public.trips for select to authenticated using (
  app.is_platform()
  or firm_id = app.admin_firm()
  or rider_id = app.rider_id()
  or driver_id = app.driver_id()
  or app.is_company_trip(trips, app.admin_company())
);

create policy "offers" on public.job_offers for select to authenticated using (
  app.is_platform()
  or driver_id = app.driver_id()
  or exists (select 1 from public.drivers d where d.id = job_offers.driver_id and d.firm_id = app.admin_firm())
);

-- Drafts are internal until Flyt sends them.
create policy "fee invoices" on public.fee_invoices for select to authenticated using (
  app.is_platform() or (firm_id = app.admin_firm() and status <> 'draft')
);
create policy "company invoices" on public.company_invoices for select to authenticated using (
  app.is_platform() or (company_id = app.admin_company() and status <> 'draft')
);

create policy "incidents" on public.incidents for select to authenticated using (
  app.is_platform()
  or exists (select 1 from public.trips t where t.id = incidents.trip_id and t.firm_id = app.admin_firm())
);

create policy "admins" on public.admins for select to authenticated using (
  app.is_platform() or auth_user_id = auth.uid()
);
