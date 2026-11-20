-- Flyt schema. Money is whole Rwandan francs (integer). Times are timestamptz (UTC); screens show Africa/Kigali.
-- Text ids match the app's ids (firm-1, FLT-2400, ...). Screens never write tables directly:
-- every write goes through an RPC function (see the rpc migrations), and RLS only allows reads.

create schema if not exists app;

create type public.firm_type as enum ('taxi', 'rental');
create type public.firm_status as enum ('active', 'pending_licence', 'suspended');
create type public.company_status as enum ('active', 'pending');
create type public.driver_presence as enum ('offline', 'online', 'on_trip');
create type public.driver_approval as enum ('pending', 'approved', 'suspended');
create type public.car_availability as enum ('available', 'in_use', 'out_of_service');
create type public.car_power as enum ('electric', 'fuel');
create type public.trip_type as enum ('private', 'shared_commute', 'hourly', 'daily', 'airport');
create type public.trip_status as enum ('requested', 'scheduled', 'assigned', 'driver_arriving', 'driver_arrived', 'in_progress', 'completed', 'cancelled_by_rider', 'cancelled_by_driver', 'no_driver_found');
create type public.cancelled_by as enum ('rider', 'driver', 'ops', 'system');
create type public.payment_method as enum ('momo', 'airtel', 'company_account');
create type public.payment_status as enum ('pending', 'paid', 'billed_to_company', 'failed');
create type public.document_type as enum ('driving_licence', 'national_id', 'criminal_record', 'professional_certificate', 'registration', 'inspection', 'insurance');
create type public.document_review as enum ('on_file', 'missing', 'pending_review', 'rejected');
create type public.offer_status as enum ('pending', 'accepted', 'declined', 'expired');
create type public.invoice_status as enum ('draft', 'sent', 'paid');
create type public.incident_type as enum ('safety', 'complaint', 'damage', 'lost_item', 'other');
create type public.incident_status as enum ('open', 'investigating', 'closed');
create type public.admin_role as enum ('platform_admin', 'firm_admin', 'company_admin');
create type public.plan_name as enum ('Baseline', 'Test');
create type public.language as enum ('en', 'rw', 'fr');

-- Last 9 digits of a Rwandan mobile number (7XXXXXXXX), used to match a signed-in phone to a person.
create function app.phone_key(phone text) returns text language sql immutable as $$
  select right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 9)
$$;

create table public.places (
  id text primary key,
  name text not null,
  lat double precision,
  lng double precision
);

create table public.place_distances (
  from_place text not null references public.places (id),
  to_place text not null references public.places (id),
  km numeric(5, 1) not null check (km > 0),
  primary key (from_place, to_place),
  check (from_place <> to_place)
);

create table public.firms (
  id text primary key,
  name text not null,
  type public.firm_type not null,
  rura_licence_no text not null,
  licence_expiry date not null,
  tin text not null check (tin ~ '^\d{9}$'),
  momo_merchant_code text not null,
  airtel_merchant_code text not null,
  fee_percent integer not null default 12 check (fee_percent in (10, 12, 15)),
  hourly_rate integer check (hourly_rate > 0),
  daily_rate integer check (daily_rate > 0),
  status public.firm_status not null default 'pending_licence',
  created_at timestamptz not null default now()
);
create unique index firms_licence_key on public.firms (lower(rura_licence_no));

create table public.companies (
  id text primary key,
  name text not null,
  contact_name text not null,
  phone text not null,
  staff_count integer not null check (staff_count >= 1),
  status public.company_status not null default 'active',
  join_code text not null check (join_code ~ '^[A-Z0-9-]{4,20}$'),
  created_at timestamptz not null default now()
);
create unique index companies_name_key on public.companies (lower(name));
create unique index companies_join_code_key on public.companies (lower(join_code));

create table public.riders (
  id text primary key,
  auth_user_id uuid unique references auth.users (id) on delete set null,
  name text not null,
  phone text not null,
  phone_key text generated always as (app.phone_key(phone)) stored,
  language public.language not null default 'en',
  company_id text references public.companies (id),
  saved_places jsonb not null default '[]',
  emergency_contacts jsonb not null default '[]',
  consent_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index riders_phone_key on public.riders (phone_key);
create index riders_company_idx on public.riders (company_id);

create table public.cars (
  id text primary key,
  firm_id text not null references public.firms (id),
  plate text not null unique check (plate ~ '^R[A-Z]{2} \d{3} [A-Z]$'),
  make text not null,
  model text not null,
  colour text not null,
  year integer not null check (year between 2000 and 2100),
  seats integer not null check (seats between 1 and 8),
  power public.car_power not null,
  availability public.car_availability not null default 'available',
  zone text not null references public.places (id)
);
create index cars_firm_idx on public.cars (firm_id);

create table public.drivers (
  id text primary key,
  auth_user_id uuid unique references auth.users (id) on delete set null,
  firm_id text not null references public.firms (id),
  name text not null,
  phone text not null,
  phone_key text generated always as (app.phone_key(phone)) stored,
  rating numeric(2, 1) not null default 5 check (rating between 1 and 5),
  status public.driver_presence not null default 'offline',
  approval public.driver_approval not null default 'pending',
  zone text not null references public.places (id),
  car_id text unique references public.cars (id),
  -- Suspended while on a trip: the suspension takes effect when that trip ends.
  suspend_after_trip boolean not null default false
);
create unique index drivers_phone_key on public.drivers (phone_key);
create index drivers_firm_idx on public.drivers (firm_id);

-- Compliance documents of drivers and cars. The file (if sent) is in the private "documents" storage bucket.
create table public.documents (
  id text primary key,
  driver_id text references public.drivers (id) on delete cascade,
  car_id text references public.cars (id) on delete cascade,
  type public.document_type not null,
  expiry_date date,
  review public.document_review not null default 'missing',
  reject_reason text check (char_length(reject_reason) <= 200),
  file_path text,
  updated_at timestamptz not null default now(),
  check ((driver_id is null) <> (car_id is null))
);
create unique index documents_driver_type_key on public.documents (driver_id, type) where driver_id is not null;
create unique index documents_car_type_key on public.documents (car_id, type) where car_id is not null;

create table public.pricing_plans (
  name public.plan_name primary key,
  first_km integer not null check (first_km >= 0),
  per_km integer not null check (per_km >= 0),
  shared_seat_percent integer not null check (shared_seat_percent between 1 and 100),
  is_active boolean not null default false
);
-- Exactly one plan is active at a time.
create unique index pricing_plans_one_active on public.pricing_plans (is_active) where is_active;

-- Fixed price between the airport and a place. A null price means the private-ride formula is used.
create table public.airport_zones (
  place_id text primary key references public.places (id) check (place_id <> 'airport'),
  price integer check (price > 0)
);

create table public.commute_routes (
  id text primary key,
  company_id text not null references public.companies (id),
  name text not null,
  stops text[] not null,
  departure_times text[] not null,
  seats_per_car integer not null check (seats_per_car between 1 and 8),
  rider_ids text[] not null default '{}'
);
create index commute_routes_company_idx on public.commute_routes (company_id);

create sequence public.trip_number start 3000;

create table public.trips (
  id text primary key default ('FLT-' || nextval('public.trip_number')),
  type public.trip_type not null,
  rider_id text not null references public.riders (id),
  company_id text references public.companies (id),
  firm_id text not null references public.firms (id),
  driver_id text references public.drivers (id),
  car_id text references public.cars (id),
  pickup text not null references public.places (id),
  dropoff text not null references public.places (id),
  distance_km numeric(5, 1) not null check (distance_km >= 0),
  hire_quantity integer check (hire_quantity >= 1),
  scheduled_for timestamptz,
  fare integer not null check (fare >= 0),
  platform_fee integer not null check (platform_fee >= 0 and platform_fee <= fare),
  plan_name public.plan_name not null,
  status public.trip_status not null,
  payment_method public.payment_method not null,
  payment_status public.payment_status not null,
  receipt_no text,
  rider_rating integer check (rider_rating between 1 and 5),
  rating_tags text[],
  rating_comment text check (char_length(rating_comment) <= 500),
  driver_rating integer check (driver_rating between 1 and 5),
  cancel_reason text,
  cancelled_by public.cancelled_by,
  commute_route_id text references public.commute_routes (id),
  -- Fare corrections after the trip ended: [{at, byAdminId, fromFare, toFare, reason, feePercent}]
  corrections jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  assigned_at timestamptz,
  accepted_at timestamptz,
  arrived_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  rider_paid_at timestamptz,
  paid_at timestamptz
);
create index trips_rider_idx on public.trips (rider_id);
create index trips_driver_idx on public.trips (driver_id);
create index trips_firm_idx on public.trips (firm_id);
create index trips_company_idx on public.trips (company_id);
create index trips_status_idx on public.trips (status);

create table public.job_offers (
  id text primary key default ('offer-' || gen_random_uuid()),
  trip_id text not null references public.trips (id),
  driver_id text not null references public.drivers (id),
  status public.offer_status not null default 'pending',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index job_offers_driver_idx on public.job_offers (driver_id);
create index job_offers_trip_idx on public.job_offers (trip_id);

-- Invoices keep the trips they billed (lines) and later corrections (adjustments) as jsonb:
-- lines [{tripId, fare, fee}], adjustments [{tripId, fromPeriod, fare, fee, reason}]. Totals include adjustments.
create table public.fee_invoices (
  id text primary key,
  firm_id text not null references public.firms (id),
  period text not null check (period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  trip_count integer not null,
  fares_total integer not null,
  fee_total integer not null,
  status public.invoice_status not null default 'draft',
  lines jsonb not null default '[]',
  adjustments jsonb not null default '[]',
  unique (firm_id, period)
);

create table public.company_invoices (
  id text primary key,
  company_id text not null references public.companies (id),
  period text not null check (period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  trip_count integer not null,
  total integer not null,
  status public.invoice_status not null default 'draft',
  lines jsonb not null default '[]',
  adjustments jsonb not null default '[]',
  unique (company_id, period)
);

create table public.incidents (
  id text primary key default ('INC-' || substr(md5(gen_random_uuid()::text), 1, 6)),
  trip_id text references public.trips (id),
  type public.incident_type not null,
  description text not null check (char_length(description) between 1 and 1000),
  status public.incident_status not null default 'open',
  notes text[] not null default '{}',
  reported_by text,
  created_at timestamptz not null default now()
);

create table public.admins (
  id text primary key,
  auth_user_id uuid unique references auth.users (id) on delete set null,
  name text not null,
  phone text not null,
  phone_key text generated always as (app.phone_key(phone)) stored,
  role public.admin_role not null,
  firm_id text references public.firms (id),
  company_id text references public.companies (id),
  check ((role = 'firm_admin') = (firm_id is not null)),
  check ((role = 'company_admin') = (company_id is not null))
);
create unique index admins_phone_role_key on public.admins (phone_key, role);
