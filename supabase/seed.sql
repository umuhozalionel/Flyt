-- Local demo data for Supabase, generated from lib/mock-data.ts (scripts/supabase-sql.ts). Loaded by supabase db reset.
-- Names, phone numbers, TINs, licence numbers and merchant codes are made up.
-- Times are relative to midnight in Kigali today, and dates to today, so the demo always looks current.
-- Local sign-in: SMS code 123456 for every seeded phone (config.toml), or the dev email sign-in
-- (<id>@flyt.test, password in scripts/supabase-sql.ts) when NEXT_PUBLIC_DEV_SIGNIN=true. Both are local only.

create function pg_temp.at(minutes integer) returns timestamptz language sql stable as $$
  select (date_trunc('day', now() at time zone 'Africa/Kigali') at time zone 'Africa/Kigali') + minutes * interval '1 minute'
$$;
create function pg_temp.day(days integer) returns date language sql stable as $$
  select (now() at time zone 'Africa/Kigali')::date + days
$$;

insert into public.pricing_plans (name, first_km, per_km, shared_seat_percent, is_active) values
  ('Baseline', 1500, 1000, 40, false),
  ('Test', 1200, 750, 40, true);

insert into public.airport_zones (place_id, price) values
  ('city-centre', 12000),
  ('remera', null),
  ('kicukiro', 9000),
  ('kcc', 10000);

insert into public.firms (id, name, type, rura_licence_no, licence_expiry, tin, momo_merchant_code, airtel_merchant_code, fee_percent, hourly_rate, daily_rate, status) values
  ('firm-1', 'Kigali City Cabs Cooperative', 'taxi', 'RURA/TX/2025/0418', pg_temp.day(590), '103847261', '*182*8*1*482910#', '*500*4*2*482911#', 12, null, null, 'active'),
  ('firm-2', 'Imena Mobility Rentals', 'rental', 'RURA/RN/2025/0281', pg_temp.day(450), '109284735', '*182*8*1*731640#', '*500*4*2*731641#', 12, 12000, 40000, 'active'),
  ('firm-3', 'Virunga Executive Cars', 'rental', 'RURA/RN/2026/0093', pg_temp.day(29), '101736492', '*182*8*1*622180#', '*500*4*2*622181#', 12, 15000, 55000, 'pending_licence');

insert into public.companies (id, name, contact_name, phone, staff_count, status, join_code) values
  ('co-1', 'Akagera Group', 'Solange Mutesi', '+250 788 600 101', 86, 'active', 'AKAGERA-24'),
  ('co-2', 'Kivu Health Network', 'Olivier Ndayisaba', '+250 788 600 102', 42, 'active', 'KIVU-18'),
  ('co-3', 'Imanzi Technologies', 'Clarisse Umutoni', '+250 788 600 103', 28, 'active', 'IMANZI-31'),
  ('co-4', 'Rwanda Creative House', 'Fabrice Mugisha', '+250 788 600 104', 19, 'active', 'CREATIVE-07');

insert into public.riders (id, name, phone, language, company_id, saved_places, emergency_contacts, consent_at, created_at) values
  ('rider-1', 'Aline Mukamana', '+250 788 410 301', 'en', 'co-1', '[{"id":"sp-1-home","label":"Home","placeId":"kicukiro"},{"id":"sp-1-work","label":"Work","placeId":"kcc"}]'::jsonb, '[{"id":"ec-1","name":"Jean Mukamana","phone":"+250 788 410 900"}]'::jsonb, pg_temp.at(-46980), pg_temp.at(-46980)),
  ('rider-2', 'Eric Niyonzima', '+250 788 410 302', 'en', 'co-1', '[{"id":"sp-2-home","label":"Home","placeId":"remera"},{"id":"sp-2-work","label":"Work","placeId":"city-centre"}]'::jsonb, '[]'::jsonb, pg_temp.at(-46980), pg_temp.at(-46980)),
  ('rider-3', 'Diane Uwase', '+250 788 410 303', 'en', 'co-1', '[{"id":"sp-3-home","label":"Home","placeId":"kimihurura"},{"id":"sp-3-work","label":"Work","placeId":"kacyiru"}]'::jsonb, '[]'::jsonb, pg_temp.at(-46980), pg_temp.at(-46980)),
  ('rider-4', 'Patrick Habimana', '+250 788 410 304', 'en', 'co-2', '[{"id":"sp-4-home","label":"Home","placeId":"kacyiru"},{"id":"sp-4-work","label":"Work","placeId":"remera"}]'::jsonb, '[]'::jsonb, pg_temp.at(-46980), pg_temp.at(-46980)),
  ('rider-5', 'Jeanine Ingabire', '+250 788 410 305', 'en', 'co-2', '[{"id":"sp-5-home","label":"Home","placeId":"nyamirambo"},{"id":"sp-5-work","label":"Work","placeId":"kcc"}]'::jsonb, '[]'::jsonb, pg_temp.at(-46980), pg_temp.at(-46980)),
  ('rider-6', 'Yves Nshimiyimana', '+250 788 410 306', 'en', 'co-2', '[{"id":"sp-6-home","label":"Home","placeId":"gisozi"},{"id":"sp-6-work","label":"Work","placeId":"city-centre"}]'::jsonb, '[]'::jsonb, pg_temp.at(-46980), pg_temp.at(-46980)),
  ('rider-7', 'Chantal Uwera', '+250 788 410 307', 'en', 'co-3', '[{"id":"sp-7-home","label":"Home","placeId":"kicukiro"},{"id":"sp-7-work","label":"Work","placeId":"kacyiru"}]'::jsonb, '[]'::jsonb, pg_temp.at(-46980), pg_temp.at(-46980)),
  ('rider-8', 'Jean Bosco Hakizimana', '+250 788 410 308', 'en', 'co-3', '[{"id":"sp-8-home","label":"Home","placeId":"remera"},{"id":"sp-8-work","label":"Work","placeId":"remera"}]'::jsonb, '[]'::jsonb, pg_temp.at(-46980), pg_temp.at(-46980)),
  ('rider-9', 'Grace Iradukunda', '+250 788 410 309', 'en', 'co-3', '[{"id":"sp-9-home","label":"Home","placeId":"kimihurura"},{"id":"sp-9-work","label":"Work","placeId":"kcc"}]'::jsonb, '[]'::jsonb, pg_temp.at(-46980), pg_temp.at(-46980)),
  ('rider-10', 'Thierry Mugabo', '+250 788 410 310', 'en', 'co-4', '[{"id":"sp-10-home","label":"Home","placeId":"kacyiru"},{"id":"sp-10-work","label":"Work","placeId":"city-centre"}]'::jsonb, '[]'::jsonb, pg_temp.at(-46980), pg_temp.at(-46980)),
  ('rider-11', 'Sandrine Umuhire', '+250 788 410 311', 'en', 'co-4', '[{"id":"sp-11-home","label":"Home","placeId":"nyamirambo"},{"id":"sp-11-work","label":"Work","placeId":"kacyiru"}]'::jsonb, '[]'::jsonb, pg_temp.at(-46980), pg_temp.at(-46980)),
  ('rider-12', 'Kevin Ishimwe', '+250 788 410 312', 'en', 'co-4', '[{"id":"sp-12-home","label":"Home","placeId":"gisozi"},{"id":"sp-12-work","label":"Work","placeId":"remera"}]'::jsonb, '[]'::jsonb, pg_temp.at(-46980), pg_temp.at(-46980)),
  ('rider-13', 'Vestine Nyiraneza', '+250 788 410 313', 'en', null, '[{"id":"sp-13-home","label":"Home","placeId":"kicukiro"},{"id":"sp-13-work","label":"Work","placeId":"kcc"}]'::jsonb, '[]'::jsonb, pg_temp.at(-46980), pg_temp.at(-46980)),
  ('rider-14', 'Alain Rukundo', '+250 788 410 314', 'en', null, '[{"id":"sp-14-home","label":"Home","placeId":"remera"},{"id":"sp-14-work","label":"Work","placeId":"city-centre"}]'::jsonb, '[]'::jsonb, pg_temp.at(-46980), pg_temp.at(-46980)),
  ('rider-15', 'Esther Mukeshimana', '+250 788 410 315', 'en', null, '[{"id":"sp-15-home","label":"Home","placeId":"kimihurura"},{"id":"sp-15-work","label":"Work","placeId":"kacyiru"}]'::jsonb, '[]'::jsonb, pg_temp.at(-46980), pg_temp.at(-46980)),
  ('rider-16', 'Innocent Twagirayezu', '+250 788 410 316', 'en', null, '[{"id":"sp-16-home","label":"Home","placeId":"kacyiru"},{"id":"sp-16-work","label":"Work","placeId":"remera"}]'::jsonb, '[]'::jsonb, pg_temp.at(-46980), pg_temp.at(-46980)),
  ('rider-17', 'Liliane Uwamariya', '+250 788 410 317', 'en', null, '[{"id":"sp-17-home","label":"Home","placeId":"nyamirambo"},{"id":"sp-17-work","label":"Work","placeId":"kcc"}]'::jsonb, '[]'::jsonb, pg_temp.at(-46980), pg_temp.at(-46980)),
  ('rider-18', 'Emmanuel Gatete', '+250 788 410 318', 'en', null, '[{"id":"sp-18-home","label":"Home","placeId":"gisozi"},{"id":"sp-18-work","label":"Work","placeId":"city-centre"}]'::jsonb, '[]'::jsonb, pg_temp.at(-46980), pg_temp.at(-46980)),
  ('rider-19', 'Josiane Mukandayisenga', '+250 788 410 319', 'en', null, '[{"id":"sp-19-home","label":"Home","placeId":"kicukiro"},{"id":"sp-19-work","label":"Work","placeId":"kacyiru"}]'::jsonb, '[]'::jsonb, pg_temp.at(-46980), pg_temp.at(-46980)),
  ('rider-20', 'Pacifique Niyitegeka', '+250 788 410 320', 'en', null, '[{"id":"sp-20-home","label":"Home","placeId":"remera"},{"id":"sp-20-work","label":"Work","placeId":"remera"}]'::jsonb, '[]'::jsonb, pg_temp.at(-46980), pg_temp.at(-46980)),
  ('rider-21', 'Beatrice Uwimana', '+250 788 410 321', 'en', null, '[{"id":"sp-21-home","label":"Home","placeId":"kimihurura"},{"id":"sp-21-work","label":"Work","placeId":"kcc"}]'::jsonb, '[]'::jsonb, pg_temp.at(-46980), pg_temp.at(-46980)),
  ('rider-22', 'Fiston Irakoze', '+250 788 410 322', 'en', null, '[{"id":"sp-22-home","label":"Home","placeId":"kacyiru"},{"id":"sp-22-work","label":"Work","placeId":"city-centre"}]'::jsonb, '[]'::jsonb, pg_temp.at(-46980), pg_temp.at(-46980)),
  ('rider-23', 'Nadine Umubyeyi', '+250 788 410 323', 'en', null, '[{"id":"sp-23-home","label":"Home","placeId":"nyamirambo"},{"id":"sp-23-work","label":"Work","placeId":"kacyiru"}]'::jsonb, '[]'::jsonb, pg_temp.at(-46980), pg_temp.at(-46980)),
  ('rider-24', 'Claude Munyaneza', '+250 788 410 324', 'en', null, '[{"id":"sp-24-home","label":"Home","placeId":"gisozi"},{"id":"sp-24-work","label":"Work","placeId":"remera"}]'::jsonb, '[]'::jsonb, pg_temp.at(-46980), pg_temp.at(-46980)),
  ('rider-25', 'Gloria Ingabire', '+250 788 410 325', 'en', null, '[{"id":"sp-25-home","label":"Home","placeId":"kicukiro"},{"id":"sp-25-work","label":"Work","placeId":"kcc"}]'::jsonb, '[]'::jsonb, pg_temp.at(-46980), pg_temp.at(-46980)),
  ('rider-26', 'Didier Bizimungu', '+250 788 410 326', 'en', null, '[{"id":"sp-26-home","label":"Home","placeId":"remera"},{"id":"sp-26-work","label":"Work","placeId":"city-centre"}]'::jsonb, '[]'::jsonb, pg_temp.at(-46980), pg_temp.at(-46980)),
  ('rider-27', 'Ange Mukarukundo', '+250 788 410 327', 'en', null, '[{"id":"sp-27-home","label":"Home","placeId":"kimihurura"},{"id":"sp-27-work","label":"Work","placeId":"kacyiru"}]'::jsonb, '[]'::jsonb, pg_temp.at(-46980), pg_temp.at(-46980)),
  ('rider-28', 'Samuel Kamanzi', '+250 788 410 328', 'en', null, '[{"id":"sp-28-home","label":"Home","placeId":"kacyiru"},{"id":"sp-28-work","label":"Work","placeId":"remera"}]'::jsonb, '[]'::jsonb, pg_temp.at(-46980), pg_temp.at(-46980)),
  ('rider-29', 'Delphine Nyirahabimana', '+250 788 410 329', 'en', null, '[{"id":"sp-29-home","label":"Home","placeId":"nyamirambo"},{"id":"sp-29-work","label":"Work","placeId":"kcc"}]'::jsonb, '[]'::jsonb, pg_temp.at(-46980), pg_temp.at(-46980)),
  ('rider-30', 'Moses Habyarimana', '+250 788 410 330', 'en', null, '[{"id":"sp-30-home","label":"Home","placeId":"gisozi"},{"id":"sp-30-work","label":"Work","placeId":"city-centre"}]'::jsonb, '[]'::jsonb, pg_temp.at(-46980), pg_temp.at(-46980));

insert into public.cars (id, firm_id, plate, make, model, colour, year, seats, power, availability, zone) values
  ('car-1', 'firm-1', 'RAG 120 B', 'Toyota', 'Corolla', 'Pearl white', 2020, 4, 'fuel', 'in_use', 'city-centre'),
  ('car-2', 'firm-1', 'RAC 157 C', 'Hyundai', 'Ioniq 5', 'Midnight blue', 2021, 4, 'electric', 'available', 'remera'),
  ('car-3', 'firm-1', 'RAD 194 D', 'Volkswagen', 'Passat', 'Silver', 2022, 4, 'fuel', 'in_use', 'kimihurura'),
  ('car-4', 'firm-1', 'RAE 231 E', 'Nissan', 'Leaf', 'Charcoal', 2023, 4, 'electric', 'available', 'kacyiru'),
  ('car-5', 'firm-1', 'RAG 268 F', 'Toyota', 'RAV4', 'Red', 2024, 4, 'fuel', 'in_use', 'kicukiro'),
  ('car-6', 'firm-1', 'RAC 305 G', 'Kia', 'Niro EV', 'Black', 2025, 4, 'electric', 'available', 'nyabugogo'),
  ('car-7', 'firm-2', 'RAD 342 H', 'Toyota', 'Corolla', 'Pearl white', 2020, 4, 'fuel', 'in_use', 'kcc'),
  ('car-8', 'firm-2', 'RAE 379 I', 'Hyundai', 'Ioniq 5', 'Midnight blue', 2021, 4, 'electric', 'available', 'gisozi'),
  ('car-9', 'firm-2', 'RAG 416 J', 'Volkswagen', 'Passat', 'Silver', 2022, 4, 'fuel', 'in_use', 'remera'),
  ('car-10', 'firm-2', 'RAC 453 K', 'Nissan', 'Leaf', 'Charcoal', 2023, 4, 'electric', 'available', 'city-centre'),
  ('car-11', 'firm-2', 'RAD 490 L', 'Toyota', 'RAV4', 'Red', 2024, 4, 'fuel', 'available', 'nyamirambo'),
  ('car-12', 'firm-2', 'RAE 527 M', 'Kia', 'Niro EV', 'Black', 2025, 4, 'electric', 'out_of_service', 'kicukiro');

insert into public.drivers (id, firm_id, name, phone, rating, status, approval, zone, car_id, suspend_after_trip) values
  ('driver-1', 'firm-1', 'Emmanuel Karemera', '+250 788 330 110', 4.9, 'on_trip', 'approved', 'city-centre', 'car-1', false),
  ('driver-2', 'firm-1', 'Grace Uwamahoro', '+250 788 330 111', 4.8, 'online', 'approved', 'remera', 'car-2', false),
  ('driver-3', 'firm-1', 'David Nkurunziza', '+250 788 330 112', 4.7, 'on_trip', 'approved', 'kimihurura', 'car-3', false),
  ('driver-4', 'firm-1', 'Beatrice Mukamana', '+250 788 330 113', 4.9, 'online', 'approved', 'kacyiru', 'car-4', false),
  ('driver-5', 'firm-1', 'Samuel Bizimana', '+250 788 330 114', 4.6, 'on_trip', 'approved', 'kicukiro', 'car-5', false),
  ('driver-6', 'firm-1', 'Claudine Nyirahabimana', '+250 788 330 115', 4.8, 'offline', 'pending', 'nyabugogo', 'car-6', false),
  ('driver-7', 'firm-2', 'Joseph Ntwari', '+250 788 330 116', 4.8, 'on_trip', 'approved', 'kcc', 'car-7', false),
  ('driver-8', 'firm-2', 'Florence Mukashyaka', '+250 788 330 117', 4.9, 'online', 'approved', 'gisozi', 'car-8', false),
  ('driver-9', 'firm-2', 'Theogene Sibomana', '+250 788 330 118', 4.7, 'on_trip', 'approved', 'remera', 'car-9', false),
  ('driver-10', 'firm-2', 'Agnes Uwizeye', '+250 788 330 119', 4.8, 'online', 'approved', 'city-centre', 'car-10', false),
  ('driver-11', 'firm-2', 'Robert Kayitare', '+250 788 330 120', 4.6, 'offline', 'approved', 'nyamirambo', 'car-11', false),
  ('driver-12', 'firm-2', 'Marie Claire Umutesi', '+250 788 330 121', 4.5, 'offline', 'suspended', 'kicukiro', 'car-12', false);

insert into public.documents (id, driver_id, car_id, type, expiry_date, review, reject_reason) values
  ('driver-1-driving_licence', 'driver-1', null, 'driving_licence', pg_temp.day(400), 'on_file', null),
  ('driver-1-national_id', 'driver-1', null, 'national_id', null, 'on_file', null),
  ('driver-1-criminal_record', 'driver-1', null, 'criminal_record', pg_temp.day(150), 'on_file', null),
  ('driver-1-professional_certificate', 'driver-1', null, 'professional_certificate', pg_temp.day(250), 'on_file', null),
  ('driver-2-driving_licence', 'driver-2', null, 'driving_licence', pg_temp.day(420), 'on_file', null),
  ('driver-2-national_id', 'driver-2', null, 'national_id', null, 'on_file', null),
  ('driver-2-criminal_record', 'driver-2', null, 'criminal_record', pg_temp.day(155), 'on_file', null),
  ('driver-2-professional_certificate', 'driver-2', null, 'professional_certificate', pg_temp.day(260), 'on_file', null),
  ('driver-3-driving_licence', 'driver-3', null, 'driving_licence', pg_temp.day(440), 'on_file', null),
  ('driver-3-national_id', 'driver-3', null, 'national_id', null, 'on_file', null),
  ('driver-3-criminal_record', 'driver-3', null, 'criminal_record', pg_temp.day(160), 'on_file', null),
  ('driver-3-professional_certificate', 'driver-3', null, 'professional_certificate', pg_temp.day(12), 'on_file', null),
  ('driver-4-driving_licence', 'driver-4', null, 'driving_licence', pg_temp.day(460), 'on_file', null),
  ('driver-4-national_id', 'driver-4', null, 'national_id', null, 'on_file', null),
  ('driver-4-criminal_record', 'driver-4', null, 'criminal_record', pg_temp.day(165), 'on_file', null),
  ('driver-4-professional_certificate', 'driver-4', null, 'professional_certificate', pg_temp.day(280), 'on_file', null),
  ('driver-5-driving_licence', 'driver-5', null, 'driving_licence', pg_temp.day(480), 'on_file', null),
  ('driver-5-national_id', 'driver-5', null, 'national_id', null, 'on_file', null),
  ('driver-5-criminal_record', 'driver-5', null, 'criminal_record', pg_temp.day(170), 'on_file', null),
  ('driver-5-professional_certificate', 'driver-5', null, 'professional_certificate', pg_temp.day(290), 'on_file', null),
  ('driver-6-driving_licence', 'driver-6', null, 'driving_licence', pg_temp.day(500), 'on_file', null),
  ('driver-6-national_id', 'driver-6', null, 'national_id', null, 'on_file', null),
  ('driver-6-criminal_record', 'driver-6', null, 'criminal_record', pg_temp.day(175), 'missing', null),
  ('driver-6-professional_certificate', 'driver-6', null, 'professional_certificate', pg_temp.day(300), 'on_file', null),
  ('driver-7-driving_licence', 'driver-7', null, 'driving_licence', pg_temp.day(520), 'on_file', null),
  ('driver-7-national_id', 'driver-7', null, 'national_id', null, 'on_file', null),
  ('driver-7-criminal_record', 'driver-7', null, 'criminal_record', pg_temp.day(180), 'on_file', null),
  ('driver-7-professional_certificate', 'driver-7', null, 'professional_certificate', pg_temp.day(310), 'on_file', null),
  ('driver-8-driving_licence', 'driver-8', null, 'driving_licence', pg_temp.day(540), 'on_file', null),
  ('driver-8-national_id', 'driver-8', null, 'national_id', null, 'on_file', null),
  ('driver-8-criminal_record', 'driver-8', null, 'criminal_record', pg_temp.day(185), 'on_file', null),
  ('driver-8-professional_certificate', 'driver-8', null, 'professional_certificate', pg_temp.day(320), 'on_file', null),
  ('driver-9-driving_licence', 'driver-9', null, 'driving_licence', pg_temp.day(560), 'on_file', null),
  ('driver-9-national_id', 'driver-9', null, 'national_id', null, 'on_file', null),
  ('driver-9-criminal_record', 'driver-9', null, 'criminal_record', pg_temp.day(190), 'on_file', null),
  ('driver-9-professional_certificate', 'driver-9', null, 'professional_certificate', pg_temp.day(330), 'on_file', null),
  ('driver-10-driving_licence', 'driver-10', null, 'driving_licence', pg_temp.day(20), 'on_file', null),
  ('driver-10-national_id', 'driver-10', null, 'national_id', null, 'on_file', null),
  ('driver-10-criminal_record', 'driver-10', null, 'criminal_record', pg_temp.day(195), 'on_file', null),
  ('driver-10-professional_certificate', 'driver-10', null, 'professional_certificate', pg_temp.day(340), 'on_file', null),
  ('driver-11-driving_licence', 'driver-11', null, 'driving_licence', pg_temp.day(600), 'on_file', null),
  ('driver-11-national_id', 'driver-11', null, 'national_id', null, 'on_file', null),
  ('driver-11-criminal_record', 'driver-11', null, 'criminal_record', pg_temp.day(200), 'pending_review', null),
  ('driver-11-professional_certificate', 'driver-11', null, 'professional_certificate', pg_temp.day(350), 'on_file', null),
  ('driver-12-driving_licence', 'driver-12', null, 'driving_licence', pg_temp.day(-6), 'on_file', null),
  ('driver-12-national_id', 'driver-12', null, 'national_id', null, 'on_file', null),
  ('driver-12-criminal_record', 'driver-12', null, 'criminal_record', pg_temp.day(205), 'on_file', null),
  ('driver-12-professional_certificate', 'driver-12', null, 'professional_certificate', pg_temp.day(360), 'on_file', null),
  ('car-1-registration', null, 'car-1', 'registration', pg_temp.day(500), 'on_file', null),
  ('car-1-inspection', null, 'car-1', 'inspection', pg_temp.day(120), 'on_file', null),
  ('car-1-insurance', null, 'car-1', 'insurance', pg_temp.day(200), 'on_file', null),
  ('car-2-registration', null, 'car-2', 'registration', pg_temp.day(515), 'on_file', null),
  ('car-2-inspection', null, 'car-2', 'inspection', pg_temp.day(129), 'on_file', null),
  ('car-2-insurance', null, 'car-2', 'insurance', pg_temp.day(211), 'on_file', null),
  ('car-3-registration', null, 'car-3', 'registration', pg_temp.day(530), 'on_file', null),
  ('car-3-inspection', null, 'car-3', 'inspection', pg_temp.day(138), 'on_file', null),
  ('car-3-insurance', null, 'car-3', 'insurance', pg_temp.day(222), 'on_file', null),
  ('car-4-registration', null, 'car-4', 'registration', pg_temp.day(545), 'on_file', null),
  ('car-4-inspection', null, 'car-4', 'inspection', pg_temp.day(9), 'on_file', null),
  ('car-4-insurance', null, 'car-4', 'insurance', pg_temp.day(233), 'on_file', null),
  ('car-5-registration', null, 'car-5', 'registration', pg_temp.day(560), 'on_file', null),
  ('car-5-inspection', null, 'car-5', 'inspection', pg_temp.day(156), 'on_file', null),
  ('car-5-insurance', null, 'car-5', 'insurance', pg_temp.day(244), 'on_file', null),
  ('car-6-registration', null, 'car-6', 'registration', pg_temp.day(575), 'on_file', null),
  ('car-6-inspection', null, 'car-6', 'inspection', pg_temp.day(165), 'on_file', null),
  ('car-6-insurance', null, 'car-6', 'insurance', pg_temp.day(255), 'on_file', null),
  ('car-7-registration', null, 'car-7', 'registration', pg_temp.day(590), 'on_file', null),
  ('car-7-inspection', null, 'car-7', 'inspection', pg_temp.day(174), 'on_file', null),
  ('car-7-insurance', null, 'car-7', 'insurance', pg_temp.day(266), 'on_file', null),
  ('car-8-registration', null, 'car-8', 'registration', pg_temp.day(605), 'on_file', null),
  ('car-8-inspection', null, 'car-8', 'inspection', pg_temp.day(183), 'on_file', null),
  ('car-8-insurance', null, 'car-8', 'insurance', pg_temp.day(25), 'on_file', null),
  ('car-9-registration', null, 'car-9', 'registration', pg_temp.day(620), 'on_file', null),
  ('car-9-inspection', null, 'car-9', 'inspection', pg_temp.day(192), 'on_file', null),
  ('car-9-insurance', null, 'car-9', 'insurance', pg_temp.day(288), 'on_file', null),
  ('car-10-registration', null, 'car-10', 'registration', pg_temp.day(635), 'on_file', null),
  ('car-10-inspection', null, 'car-10', 'inspection', pg_temp.day(201), 'on_file', null),
  ('car-10-insurance', null, 'car-10', 'insurance', pg_temp.day(299), 'on_file', null),
  ('car-11-registration', null, 'car-11', 'registration', pg_temp.day(650), 'on_file', null),
  ('car-11-inspection', null, 'car-11', 'inspection', pg_temp.day(210), 'on_file', null),
  ('car-11-insurance', null, 'car-11', 'insurance', pg_temp.day(310), 'on_file', null),
  ('car-12-registration', null, 'car-12', 'registration', pg_temp.day(665), 'on_file', null),
  ('car-12-inspection', null, 'car-12', 'inspection', pg_temp.day(-3), 'on_file', null),
  ('car-12-insurance', null, 'car-12', 'insurance', pg_temp.day(321), 'on_file', null);

insert into public.commute_routes (id, company_id, name, stops, departure_times, seats_per_car, rider_ids) values
  ('route-1', 'co-1', 'Remera to Kigali Convention Centre', array['remera', 'kimihurura', 'kcc'], array['07:15', '17:30'], 3, array['rider-1', 'rider-2', 'rider-3']),
  ('route-2', 'co-2', 'Kicukiro to City Centre', array['kicukiro', 'remera', 'city-centre'], array['07:00', '17:45'], 3, array['rider-4', 'rider-5', 'rider-6']);

insert into public.trips (id, type, rider_id, company_id, firm_id, driver_id, car_id, pickup, dropoff, distance_km, hire_quantity, scheduled_for, fare, platform_fee, plan_name, status, payment_method, payment_status, receipt_no, rider_rating, rating_tags, rating_comment, driver_rating, cancel_reason, cancelled_by, commute_route_id, created_at, updated_at, assigned_at, accepted_at, arrived_at, started_at, completed_at, cancelled_at, rider_paid_at, paid_at) values
  ('FLT-2400', 'shared_commute', 'rider-2', 'co-1', 'firm-1', 'driver-2', 'car-2', 'remera', 'kcc', 3, null, null, 1400, 168, 'Baseline', 'completed', 'company_account', 'billed_to_company', 'EBM-2026-10001', 5, null, null, 5, null, null, 'route-1', pg_temp.at(-47100), pg_temp.at(-47081), pg_temp.at(-47098), pg_temp.at(-47097), pg_temp.at(-47094), pg_temp.at(-47093), pg_temp.at(-47081), null, null, null),
  ('FLT-2401', 'private', 'rider-1', null, 'firm-1', 'driver-1', 'car-1', 'kimihurura', 'kcc', 1.5, null, null, 2000, 240, 'Baseline', 'completed', 'momo', 'paid', 'EBM-2026-10002', 5, array['Friendly']::text[], null, 5, null, null, null, pg_temp.at(-45600), pg_temp.at(-45583), pg_temp.at(-45598), pg_temp.at(-45597), pg_temp.at(-45592), pg_temp.at(-45591), pg_temp.at(-45583), null, pg_temp.at(-45581), pg_temp.at(-45579)),
  ('FLT-2402', 'airport', 'rider-14', null, 'firm-1', 'driver-3', 'car-3', 'city-centre', 'airport', 10.5, null, null, 12000, 1440, 'Baseline', 'completed', 'airtel', 'paid', 'EBM-2026-10003', 4, null, null, 5, null, null, null, pg_temp.at(-44100), pg_temp.at(-44057), pg_temp.at(-44098), pg_temp.at(-44097), pg_temp.at(-44089), pg_temp.at(-44088), pg_temp.at(-44057), null, pg_temp.at(-44055), pg_temp.at(-44053)),
  ('FLT-2403', 'hourly', 'rider-15', null, 'firm-2', 'driver-7', 'car-7', 'kacyiru', 'kacyiru', 0, 3, null, 36000, 4320, 'Baseline', 'completed', 'momo', 'paid', 'EBM-2026-10004', 5, null, null, 5, null, null, null, pg_temp.at(-42600), pg_temp.at(-42412), pg_temp.at(-42598), pg_temp.at(-42597), pg_temp.at(-42593), pg_temp.at(-42592), pg_temp.at(-42412), null, pg_temp.at(-42410), pg_temp.at(-42408)),
  ('FLT-2404', 'private', 'rider-16', null, 'firm-1', null, null, 'remera', 'nyabugogo', 10, null, null, 10500, 1260, 'Baseline', 'cancelled_by_rider', 'momo', 'pending', null, null, null, null, null, 'Plans changed', 'rider', null, pg_temp.at(-40740), pg_temp.at(-40736), null, null, null, null, null, pg_temp.at(-40736), null, null),
  ('FLT-2405', 'private', 'rider-4', 'co-2', 'firm-2', 'driver-8', 'car-8', 'kicukiro', 'city-centre', 7.5, null, null, 8000, 960, 'Baseline', 'completed', 'company_account', 'billed_to_company', 'EBM-2026-10005', 5, null, null, 5, null, null, null, pg_temp.at(-39600), pg_temp.at(-39567), pg_temp.at(-39598), pg_temp.at(-39597), pg_temp.at(-39591), pg_temp.at(-39590), pg_temp.at(-39567), null, null, null),
  ('FLT-2406', 'daily', 'rider-17', null, 'firm-2', 'driver-9', 'car-9', 'kcc', 'kcc', 0, 2, null, 80000, 9600, 'Baseline', 'completed', 'momo', 'paid', 'EBM-2026-10006', 5, null, null, 5, null, null, null, pg_temp.at(-38400), pg_temp.at(-37194), pg_temp.at(-38398), pg_temp.at(-38397), pg_temp.at(-38395), pg_temp.at(-38394), pg_temp.at(-37194), null, pg_temp.at(-37192), pg_temp.at(-37190)),
  ('FLT-2407', 'private', 'rider-18', null, 'firm-1', 'driver-4', 'car-4', 'nyamirambo', 'gisozi', 9, null, null, 9500, 1140, 'Baseline', 'completed', 'airtel', 'failed', 'EBM-2026-10007', null, null, null, 5, null, null, null, pg_temp.at(-36360), pg_temp.at(-36322), pg_temp.at(-36358), pg_temp.at(-36357), pg_temp.at(-36350), pg_temp.at(-36349), pg_temp.at(-36322), null, null, null),
  ('FLT-2408', 'shared_commute', 'rider-5', 'co-2', 'firm-2', 'driver-10', 'car-10', 'kicukiro', 'city-centre', 7.5, null, null, 3200, 384, 'Baseline', 'completed', 'company_account', 'billed_to_company', 'EBM-2026-10008', 4, null, null, 5, null, null, 'route-2', pg_temp.at(-34140), pg_temp.at(-34102), pg_temp.at(-34138), pg_temp.at(-34137), pg_temp.at(-34126), pg_temp.at(-34125), pg_temp.at(-34102), null, null, null),
  ('FLT-2409', 'airport', 'rider-19', null, 'firm-1', 'driver-1', 'car-1', 'airport', 'remera', 5, null, null, 5500, 660, 'Baseline', 'completed', 'momo', 'paid', 'EBM-2026-10009', 5, null, null, 5, null, null, null, pg_temp.at(-30840), pg_temp.at(-30815), pg_temp.at(-30838), pg_temp.at(-30837), pg_temp.at(-30833), pg_temp.at(-30832), pg_temp.at(-30815), null, pg_temp.at(-30813), pg_temp.at(-30811)),
  ('FLT-2410', 'private', 'rider-20', null, 'firm-1', null, null, 'gisozi', 'kicukiro', 12.5, null, null, 13000, 1560, 'Baseline', 'no_driver_found', 'momo', 'pending', null, null, null, null, null, 'No driver accepted', 'system', null, pg_temp.at(-28260), pg_temp.at(-28256), null, null, null, null, null, pg_temp.at(-28256), null, null),
  ('FLT-2411', 'private', 'rider-1', null, 'firm-1', 'driver-3', 'car-3', 'kcc', 'remera', 3, null, null, 3500, 420, 'Baseline', 'completed', 'airtel', 'paid', 'EBM-2026-10010', 4, array['On time']::text[], null, 5, null, null, null, pg_temp.at(-24960), pg_temp.at(-24941), pg_temp.at(-24958), pg_temp.at(-24957), pg_temp.at(-24954), pg_temp.at(-24953), pg_temp.at(-24941), null, pg_temp.at(-24939), pg_temp.at(-24937)),
  ('FLT-2412', 'private', 'rider-21', null, 'firm-1', 'driver-2', 'car-2', 'city-centre', 'kimihurura', 4, null, null, 4500, 540, 'Baseline', 'cancelled_by_driver', 'momo', 'pending', null, null, null, null, null, 'Car breakdown', 'driver', null, pg_temp.at(-22380), pg_temp.at(-22374), pg_temp.at(-22378), pg_temp.at(-22377), null, null, null, pg_temp.at(-22374), null, null),
  ('FLT-2413', 'airport', 'rider-22', null, 'firm-2', 'driver-8', 'car-8', 'kicukiro', 'airport', 6.5, null, null, 9000, 1080, 'Baseline', 'completed', 'momo', 'paid', 'EBM-2026-10011', 5, null, null, 5, null, null, null, pg_temp.at(-18240), pg_temp.at(-18202), pg_temp.at(-18238), pg_temp.at(-18237), pg_temp.at(-18224), pg_temp.at(-18223), pg_temp.at(-18202), null, pg_temp.at(-18200), pg_temp.at(-18198)),
  ('FLT-2414', 'private', 'rider-7', 'co-3', 'firm-1', 'driver-4', 'car-4', 'kacyiru', 'nyamirambo', 8, null, null, 8500, 1020, 'Baseline', 'completed', 'company_account', 'billed_to_company', 'EBM-2026-10012', 5, null, null, 5, null, null, null, pg_temp.at(-14700), pg_temp.at(-14667), pg_temp.at(-14698), pg_temp.at(-14697), pg_temp.at(-14692), pg_temp.at(-14691), pg_temp.at(-14667), null, null, null),
  ('FLT-2415', 'shared_commute', 'rider-3', 'co-1', 'firm-1', 'driver-1', 'car-1', 'remera', 'kcc', 3, null, null, 1400, 168, 'Baseline', 'completed', 'company_account', 'billed_to_company', 'EBM-2026-10013', 5, null, null, 5, null, null, 'route-1', pg_temp.at(-12540), pg_temp.at(-12521), pg_temp.at(-12538), pg_temp.at(-12537), pg_temp.at(-12534), pg_temp.at(-12533), pg_temp.at(-12521), null, null, null),
  ('FLT-2416', 'private', 'rider-23', null, 'firm-2', 'driver-9', 'car-9', 'nyabugogo', 'kcc', 7.5, null, null, 8000, 960, 'Baseline', 'completed', 'airtel', 'paid', 'EBM-2026-10014', 4, null, null, 5, null, null, null, pg_temp.at(-10740), pg_temp.at(-10708), pg_temp.at(-10738), pg_temp.at(-10737), pg_temp.at(-10732), pg_temp.at(-10731), pg_temp.at(-10708), null, pg_temp.at(-10706), pg_temp.at(-10704)),
  ('FLT-2417', 'shared_commute', 'rider-6', 'co-2', 'firm-2', 'driver-7', 'car-7', 'kicukiro', 'city-centre', 7.5, null, null, 2430, 292, 'Test', 'completed', 'company_account', 'billed_to_company', 'EBM-2026-10015', 5, null, null, 5, null, null, 'route-2', pg_temp.at(-6780), pg_temp.at(-6745), pg_temp.at(-6778), pg_temp.at(-6777), pg_temp.at(-6769), pg_temp.at(-6768), pg_temp.at(-6745), null, null, null),
  ('FLT-2418', 'private', 'rider-1', null, 'firm-1', 'driver-2', 'car-2', 'kimihurura', 'city-centre', 4, null, null, 3450, 414, 'Test', 'completed', 'momo', 'paid', 'EBM-2026-10016', 5, array['Smooth ride']::text[], null, 5, null, null, null, pg_temp.at(-6660), pg_temp.at(-6638), pg_temp.at(-6658), pg_temp.at(-6657), pg_temp.at(-6653), pg_temp.at(-6652), pg_temp.at(-6638), null, pg_temp.at(-6636), pg_temp.at(-6634)),
  ('FLT-2419', 'airport', 'rider-24', null, 'firm-2', 'driver-10', 'car-10', 'airport', 'kcc', 7, null, null, 10000, 1200, 'Test', 'completed', 'momo', 'paid', 'EBM-2026-10017', 5, null, null, 5, null, null, null, pg_temp.at(-4860), pg_temp.at(-4824), pg_temp.at(-4858), pg_temp.at(-4857), pg_temp.at(-4847), pg_temp.at(-4846), pg_temp.at(-4824), null, pg_temp.at(-4822), pg_temp.at(-4820)),
  ('FLT-2420', 'private', 'rider-1', null, 'firm-1', null, null, 'kcc', 'gisozi', 8, null, null, 6450, 774, 'Test', 'cancelled_by_rider', 'airtel', 'pending', null, null, null, null, null, 'Booked by mistake', 'rider', null, pg_temp.at(-4680), pg_temp.at(-4676), null, null, null, null, null, pg_temp.at(-4676), null, null),
  ('FLT-2421', 'hourly', 'rider-25', null, 'firm-2', 'driver-8', 'car-8', 'city-centre', 'kcc', 4.5, 2, null, 24000, 2880, 'Test', 'completed', 'airtel', 'paid', 'EBM-2026-10018', 4, null, null, 5, null, null, null, pg_temp.at(-3720), pg_temp.at(-3594), pg_temp.at(-3718), pg_temp.at(-3717), pg_temp.at(-3715), pg_temp.at(-3714), pg_temp.at(-3594), null, pg_temp.at(-3592), pg_temp.at(-3590)),
  ('FLT-2422', 'private', 'rider-10', 'co-4', 'firm-1', 'driver-3', 'car-3', 'kacyiru', 'remera', 5, null, null, 4200, 504, 'Test', 'completed', 'company_account', 'billed_to_company', 'EBM-2026-10019', 5, null, null, 5, null, null, null, pg_temp.at(-3600), pg_temp.at(-3572), pg_temp.at(-3598), pg_temp.at(-3597), pg_temp.at(-3590), pg_temp.at(-3589), pg_temp.at(-3572), null, null, null),
  ('FLT-2423', 'daily', 'rider-26', null, 'firm-2', 'driver-9', 'car-9', 'remera', 'remera', 0, 1, null, 40000, 4800, 'Test', 'completed', 'momo', 'paid', 'EBM-2026-10020', 5, null, null, 5, null, null, null, pg_temp.at(-2400), pg_temp.at(-1785), pg_temp.at(-2398), pg_temp.at(-2397), pg_temp.at(-2386), pg_temp.at(-2385), pg_temp.at(-1785), null, pg_temp.at(-1783), pg_temp.at(-1781)),
  ('FLT-2424', 'private', 'rider-27', null, 'firm-1', null, null, 'nyamirambo', 'airport', 14.5, null, null, 11325, 1359, 'Test', 'no_driver_found', 'momo', 'pending', null, null, null, null, null, 'No driver accepted', 'system', null, pg_temp.at(-1860), pg_temp.at(-1856), null, null, null, null, null, pg_temp.at(-1856), null, null),
  ('FLT-2425', 'shared_commute', 'rider-2', 'co-1', 'firm-1', 'driver-4', 'car-4', 'remera', 'kcc', 3, null, null, 1080, 130, 'Test', 'completed', 'company_account', 'billed_to_company', 'EBM-2026-10021', 4, null, null, 5, null, null, 'route-1', pg_temp.at(-1020), pg_temp.at(-995), pg_temp.at(-1018), pg_temp.at(-1017), pg_temp.at(-1008), pg_temp.at(-1007), pg_temp.at(-995), null, null, null),
  ('FLT-2426', 'private', 'rider-28', null, 'firm-1', 'driver-1', 'car-1', 'gisozi', 'nyabugogo', 4, null, null, 3450, 414, 'Test', 'completed', 'momo', 'paid', 'EBM-2026-10022', 5, null, null, 5, null, null, null, pg_temp.at(-600), pg_temp.at(-579), pg_temp.at(-598), pg_temp.at(-597), pg_temp.at(-594), pg_temp.at(-593), pg_temp.at(-579), null, pg_temp.at(-577), pg_temp.at(-575)),
  ('FLT-2427', 'airport', 'rider-29', null, 'firm-2', 'driver-7', 'car-7', 'remera', 'airport', 5, null, null, 4200, 504, 'Test', 'completed', 'airtel', 'paid', 'EBM-2026-10023', 5, null, null, 5, null, null, null, pg_temp.at(-240), pg_temp.at(-213), pg_temp.at(-238), pg_temp.at(-237), pg_temp.at(-231), pg_temp.at(-230), pg_temp.at(-213), null, pg_temp.at(-211), pg_temp.at(-209)),
  ('FLT-2428', 'private', 'rider-30', null, 'firm-1', 'driver-2', 'car-2', 'kicukiro', 'kcc', 5.5, null, null, 4575, 549, 'Test', 'completed', 'momo', 'paid', 'EBM-2026-10024', 5, null, null, 5, null, null, null, pg_temp.at(400), pg_temp.at(435), pg_temp.at(402), pg_temp.at(403), pg_temp.at(416), pg_temp.at(417), pg_temp.at(435), null, pg_temp.at(437), pg_temp.at(439)),
  ('FLT-2429', 'shared_commute', 'rider-4', 'co-2', 'firm-2', 'driver-10', 'car-10', 'kicukiro', 'city-centre', 7.5, null, null, 2430, 292, 'Test', 'completed', 'company_account', 'billed_to_company', 'EBM-2026-10025', null, null, null, 5, null, null, 'route-2', pg_temp.at(425), pg_temp.at(457), pg_temp.at(427), pg_temp.at(428), pg_temp.at(433), pg_temp.at(434), pg_temp.at(457), null, null, null),
  ('FLT-2430', 'private', 'rider-13', null, 'firm-2', 'driver-8', 'car-8', 'remera', 'kacyiru', 5, null, null, 4200, 504, 'Test', 'completed', 'airtel', 'pending', 'EBM-2026-10026', null, null, null, 5, null, null, null, pg_temp.at(450), pg_temp.at(474), pg_temp.at(452), pg_temp.at(453), pg_temp.at(456), pg_temp.at(457), pg_temp.at(474), null, pg_temp.at(476), null),
  ('FLT-2431', 'private', 'rider-14', null, 'firm-1', 'driver-5', 'car-5', 'city-centre', 'kimihurura', 4, null, null, 3450, 414, 'Test', 'in_progress', 'momo', 'pending', null, null, null, null, null, null, null, null, pg_temp.at(490), pg_temp.at(499), pg_temp.at(492), pg_temp.at(493), pg_temp.at(498), pg_temp.at(499), null, null, null, null),
  ('FLT-2432', 'airport', 'rider-15', null, 'firm-2', 'driver-9', 'car-9', 'kcc', 'airport', 7, null, null, 10000, 1200, 'Test', 'in_progress', 'airtel', 'pending', null, null, null, null, null, null, null, null, pg_temp.at(500), pg_temp.at(512), pg_temp.at(502), pg_temp.at(503), pg_temp.at(511), pg_temp.at(512), null, null, null, null),
  ('FLT-2433', 'private', 'rider-16', null, 'firm-1', 'driver-3', 'car-3', 'nyabugogo', 'gisozi', 4, null, null, 3450, 414, 'Test', 'driver_arrived', 'momo', 'pending', null, null, null, null, null, null, null, null, pg_temp.at(515), pg_temp.at(522), pg_temp.at(517), pg_temp.at(518), pg_temp.at(522), null, null, null, null, null),
  ('FLT-2434', 'hourly', 'rider-17', null, 'firm-2', 'driver-7', 'car-7', 'kacyiru', 'kacyiru', 0, 2, null, 24000, 2880, 'Test', 'driver_arriving', 'momo', 'pending', null, null, null, null, null, null, null, null, pg_temp.at(520), pg_temp.at(523), pg_temp.at(522), pg_temp.at(523), null, null, null, null, null, null),
  ('FLT-2435', 'private', 'rider-18', null, 'firm-1', 'driver-1', 'car-1', 'remera', 'city-centre', 7, null, null, 5700, 684, 'Test', 'assigned', 'airtel', 'pending', null, null, null, null, null, null, null, null, pg_temp.at(525), pg_temp.at(527), pg_temp.at(527), null, null, null, null, null, null, null),
  ('FLT-2436', 'private', 'rider-19', null, 'firm-1', null, null, 'kimihurura', 'nyamirambo', 7.5, null, null, 6075, 729, 'Test', 'requested', 'momo', 'pending', null, null, null, null, null, null, null, null, pg_temp.at(530), pg_temp.at(530), null, null, null, null, null, null, null, null),
  ('FLT-2437', 'airport', 'rider-8', 'co-3', 'firm-2', null, null, 'airport', 'kicukiro', 6.5, null, null, 9000, 1080, 'Test', 'requested', 'company_account', 'billed_to_company', null, null, null, null, null, null, null, null, pg_temp.at(535), pg_temp.at(535), null, null, null, null, null, null, null, null),
  ('FLT-2438', 'daily', 'rider-20', null, 'firm-2', null, null, 'city-centre', 'city-centre', 0, 1, pg_temp.at(1920), 40000, 4800, 'Test', 'scheduled', 'momo', 'pending', null, null, null, null, null, null, null, null, pg_temp.at(540), pg_temp.at(540), null, null, null, null, null, null, null, null),
  ('FLT-2439', 'private', 'rider-11', 'co-4', 'firm-2', null, null, 'kacyiru', 'airport', 9.5, null, pg_temp.at(1920), 7575, 909, 'Test', 'scheduled', 'company_account', 'billed_to_company', null, null, null, null, null, null, null, null, pg_temp.at(545), pg_temp.at(545), null, null, null, null, null, null, null, null);

-- The assigned trip has its 20-second job offer open from the moment the data is loaded.
insert into public.job_offers (id, trip_id, driver_id, status, created_at, expires_at) values
  ('offer-seed-FLT-2435', 'FLT-2435', 'driver-1', 'pending', now(), now() + interval '20 seconds');

insert into public.incidents (id, trip_id, type, description, status, notes, reported_by, created_at) values
  ('INC-301', 'FLT-2407', 'complaint', 'Rider says the MoMo payment failed twice at drop-off.', 'investigating', array['Called the firm; checking the merchant account.']::text[], 'rider', pg_temp.at(-36322)),
  ('INC-302', 'FLT-2431', 'safety', 'Rider pressed SOS and asked for an operations check-in.', 'open', '{}', 'rider', pg_temp.at(499)),
  ('INC-303', null, 'damage', 'Minor door mark noted after inspection of RAC 157 C.', 'closed', array['Firm confirmed it was there before the pilot.']::text[], 'ops', pg_temp.at(-16380));

insert into public.admins (id, name, phone, role, firm_id, company_id) values
  ('admin-1', 'Ange Uwimana', '+250 788 200 001', 'platform_admin', null, null),
  ('admin-2', 'Jean Paul Mugenzi', '+250 788 200 002', 'firm_admin', 'firm-1', null),
  ('admin-3', 'Odette Nyiransabimana', '+250 788 200 003', 'firm_admin', 'firm-2', null),
  ('admin-4', 'Solange Mutesi', '+250 788 600 101', 'company_admin', null, 'co-1'),
  ('admin-5', 'Olivier Ndayisaba', '+250 788 600 102', 'company_admin', null, 'co-2');

-- Last month's invoices, worked out by Postgres from the trips above: the first firm and company have paid, the rest are sent.
do $$
declare last_month text := to_char((now() at time zone 'Africa/Kigali') - interval '1 month', 'YYYY-MM');
begin
  perform app.build_invoices(last_month);
  update public.fee_invoices set status = case when firm_id = 'firm-1' then 'paid' else 'sent' end::public.invoice_status where period = last_month;
  update public.company_invoices set status = case when company_id = 'co-1' then 'paid' else 'sent' end::public.invoice_status where period = last_month;
end $$;

-- Local auth users: one per seeded rider, driver and team member.
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, phone, phone_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change, phone_change, phone_change_token, email_change_token_current, reauthentication_token)
select '00000000-0000-0000-0000-000000000000', u.id::uuid, 'authenticated', 'authenticated', u.email, extensions.crypt('flyt-dev-only', extensions.gen_salt('bf')), now(), u.phone, now(),
  '{"provider":"phone","providers":["phone","email"]}', '{}', now(), now(), '', '', '', '', '', '', '', ''
from (values
  ('4764059e-0000-4000-8000-00074764059e', 'rider-1@flyt.test', '250788410301'),
  ('4764059f-0000-4000-8000-00074764059f', 'rider-2@flyt.test', '250788410302'),
  ('476405a0-0000-4000-8000-0007476405a0', 'rider-3@flyt.test', '250788410303'),
  ('476405a1-0000-4000-8000-0007476405a1', 'rider-4@flyt.test', '250788410304'),
  ('476405a2-0000-4000-8000-0007476405a2', 'rider-5@flyt.test', '250788410305'),
  ('476405a3-0000-4000-8000-0007476405a3', 'rider-6@flyt.test', '250788410306'),
  ('476405a4-0000-4000-8000-0007476405a4', 'rider-7@flyt.test', '250788410307'),
  ('476405a5-0000-4000-8000-0007476405a5', 'rider-8@flyt.test', '250788410308'),
  ('476405a6-0000-4000-8000-0007476405a6', 'rider-9@flyt.test', '250788410309'),
  ('a51cae52-0000-4000-8000-0008a51cae52', 'rider-10@flyt.test', '250788410310'),
  ('a51cae53-0000-4000-8000-0008a51cae53', 'rider-11@flyt.test', '250788410311'),
  ('a51cae54-0000-4000-8000-0008a51cae54', 'rider-12@flyt.test', '250788410312'),
  ('a51cae55-0000-4000-8000-0008a51cae55', 'rider-13@flyt.test', '250788410313'),
  ('a51cae56-0000-4000-8000-0008a51cae56', 'rider-14@flyt.test', '250788410314'),
  ('a51cae57-0000-4000-8000-0008a51cae57', 'rider-15@flyt.test', '250788410315'),
  ('a51cae58-0000-4000-8000-0008a51cae58', 'rider-16@flyt.test', '250788410316'),
  ('a51cae59-0000-4000-8000-0008a51cae59', 'rider-17@flyt.test', '250788410317'),
  ('a51cae5a-0000-4000-8000-0008a51cae5a', 'rider-18@flyt.test', '250788410318'),
  ('a51cae5b-0000-4000-8000-0008a51cae5b', 'rider-19@flyt.test', '250788410319'),
  ('a51cae71-0000-4000-8000-0008a51cae71', 'rider-20@flyt.test', '250788410320'),
  ('a51cae72-0000-4000-8000-0008a51cae72', 'rider-21@flyt.test', '250788410321'),
  ('a51cae73-0000-4000-8000-0008a51cae73', 'rider-22@flyt.test', '250788410322'),
  ('a51cae74-0000-4000-8000-0008a51cae74', 'rider-23@flyt.test', '250788410323'),
  ('a51cae75-0000-4000-8000-0008a51cae75', 'rider-24@flyt.test', '250788410324'),
  ('a51cae76-0000-4000-8000-0008a51cae76', 'rider-25@flyt.test', '250788410325'),
  ('a51cae77-0000-4000-8000-0008a51cae77', 'rider-26@flyt.test', '250788410326'),
  ('a51cae78-0000-4000-8000-0008a51cae78', 'rider-27@flyt.test', '250788410327'),
  ('a51cae79-0000-4000-8000-0008a51cae79', 'rider-28@flyt.test', '250788410328'),
  ('a51cae7a-0000-4000-8000-0008a51cae7a', 'rider-29@flyt.test', '250788410329'),
  ('a51cae90-0000-4000-8000-0008a51cae90', 'rider-30@flyt.test', '250788410330'),
  ('dc5733cc-0000-4000-8000-0008dc5733cc', 'driver-1@flyt.test', '250788330110'),
  ('dc5733cd-0000-4000-8000-0008dc5733cd', 'driver-2@flyt.test', '250788330111'),
  ('dc5733ce-0000-4000-8000-0008dc5733ce', 'driver-3@flyt.test', '250788330112'),
  ('dc5733cf-0000-4000-8000-0008dc5733cf', 'driver-4@flyt.test', '250788330113'),
  ('dc5733d0-0000-4000-8000-0008dc5733d0', 'driver-5@flyt.test', '250788330114'),
  ('dc5733d1-0000-4000-8000-0008dc5733d1', 'driver-6@flyt.test', '250788330115'),
  ('dc5733d2-0000-4000-8000-0008dc5733d2', 'driver-7@flyt.test', '250788330116'),
  ('dc5733d3-0000-4000-8000-0008dc5733d3', 'driver-8@flyt.test', '250788330117'),
  ('dc5733d4-0000-4000-8000-0008dc5733d4', 'driver-9@flyt.test', '250788330118'),
  ('ae8f45e4-0000-4000-8000-0009ae8f45e4', 'driver-10@flyt.test', '250788330119'),
  ('ae8f45e5-0000-4000-8000-0009ae8f45e5', 'driver-11@flyt.test', '250788330120'),
  ('ae8f45e6-0000-4000-8000-0009ae8f45e6', 'driver-12@flyt.test', '250788330121'),
  ('bc127133-0000-4000-8000-0007bc127133', 'admin-1@flyt.test', '250788200001'),
  ('bc127134-0000-4000-8000-0007bc127134', 'admin-2@flyt.test', '250788200002'),
  ('bc127135-0000-4000-8000-0007bc127135', 'admin-3@flyt.test', '250788200003'),
  ('bc127136-0000-4000-8000-0007bc127136', 'admin-4@flyt.test', '250788600101'),
  ('bc127137-0000-4000-8000-0007bc127137', 'admin-5@flyt.test', '250788600102')
) as u(id, email, phone);

insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id, id::text, 'phone', jsonb_build_object('sub', id::text, 'phone', phone, 'phone_verified', true), now(), now(), now() from auth.users where email like '%@flyt.test'
union all
select gen_random_uuid(), id, id::text, 'email', jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true), now(), now(), now() from auth.users where email like '%@flyt.test';

update public.riders r set auth_user_id = u.id from auth.users u where u.email = r.id || '@flyt.test';
update public.drivers d set auth_user_id = u.id from auth.users u where u.email = d.id || '@flyt.test';
update public.admins a set auth_user_id = u.id from auth.users u where u.email = a.id || '@flyt.test';

-- Local browser push: the push function inside the local Supabase network, with a dev-only secret.
insert into app.push_settings (function_url, secret) values ('http://supabase_kong_Flyt:8000/functions/v1/push', 'local-dev-push-secret');
