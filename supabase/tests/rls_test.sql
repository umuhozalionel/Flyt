-- Row level security: each role sees only its own rows. Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(60);

-- Act as a seeded person (rider-1, driver-3, admin-2...): their auth user from seed.sql.
create function pg_temp.act_as(person text) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = person || '@flyt.test'), 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.as_runner() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

-- ── Riders ──
select pg_temp.act_as('rider-1');
select is((select count(*)::int from trips), (select count(*)::int from trips where rider_id = 'rider-1'), 'rider sees only their own trips');
select ok((select count(*) from trips) > 0, 'rider sees some trips');
select is((select array_agg(id) from riders), array['rider-1'], 'rider sees only their own profile');
select is((select count(*)::int from documents), 0, 'rider sees no compliance documents');
select is((select count(*)::int from fee_invoices) + (select count(*)::int from company_invoices), 0, 'rider sees no invoices');
select is((select count(*)::int from admins), 0, 'rider sees no team members');
select is((select count(*)::int from job_offers), 0, 'rider sees no job offers');
select is((select array_agg(id order by id) from drivers), (select array_agg(distinct driver_id order by driver_id) from trips where rider_id = 'rider-1' and driver_id is not null), 'rider sees only drivers of their own trips');
select throws_ok($$update trips set fare = 1 where rider_id = 'rider-1'$$, '42501', null, 'rider cannot write trips directly');
select throws_ok($$insert into riders (id, name, phone) values ('x', 'x', '+250 788 999 999')$$, '42501', null, 'rider cannot insert rows directly');
select is((select count(*)::int from trip_pins), (select count(*)::int from trips where rider_id = 'rider-1'), 'rider sees the PIN of their own trips only');

-- ── Drivers (rule c) ──
select pg_temp.act_as('driver-3');
select is((select count(*)::int from riders), 0, 'rule c: a driver never reads the riders table');
select is((select count(*)::int from trips), (select count(*)::int from trips where driver_id = 'driver-3'), 'driver sees only their own trips');
select is((select count(*)::int from trip_pins), 0, 'driver cannot read trip PINs');
select is((driver_job('FLT-2433') ->> 'phone'), '+250 788 410 316', 'rule c: rider phone shown while the trip is active');
select is((driver_job('FLT-2433') ->> 'firstName'), 'Innocent', 'driver sees the rider''s first name');
select is((driver_job((select id from trips where driver_id = 'driver-3' and status = 'completed' limit 1)) ->> 'phone'), null, 'rule c: no rider phone after the trip ends');
select is(driver_job('FLT-2431'), null, 'driver gets nothing for another driver''s trip');
select is((select count(*)::int from documents where driver_id is not null and driver_id <> 'driver-3'), 0, 'driver sees only their own documents');
select is((select count(*)::int from job_offers where driver_id <> 'driver-3'), 0, 'driver sees only their own offers');

-- ── Firm admins ──
select pg_temp.act_as('admin-2'); -- firm-1
select is((select count(*)::int from trips where firm_id <> 'firm-1'), 0, 'firm admin sees only their firm''s trips');
select is((select count(*)::int from drivers where firm_id <> 'firm-1'), 0, 'firm admin sees only their firm''s drivers');
select is((select count(*)::int from cars where firm_id <> 'firm-1'), 0, 'firm admin sees only their firm''s cars');
select is((select count(*)::int from documents d where d.driver_id in (select id from drivers where firm_id = 'firm-1') or d.car_id in (select id from cars where firm_id = 'firm-1')), (select count(*)::int from documents), 'firm admin sees only their firm''s documents');
select is((select count(*)::int from fee_invoices where firm_id <> 'firm-1' or status = 'draft'), 0, 'firm admin sees only their own sent invoices');
select is((select count(*)::int from company_invoices), 0, 'firm admin sees no company invoices');
select is((select count(*)::int from admins), 1, 'firm admin sees only themself on the team');
select lives_ok($$select set_driver_approval('driver-2', 'suspended')$$, 'firm admin can suspend their own driver');
select is((select approval::text from drivers where id = 'driver-2'), 'suspended', 'the suspension took effect');
select throws_ok($$select set_driver_approval('driver-2', 'approved')$$, '42501', null, 'firm admin cannot approve a driver');
select throws_ok($$select set_driver_approval('driver-8', 'suspended')$$, '42501', null, 'firm admin cannot suspend another firm''s driver');
select lives_ok($$select set_driver_approval('driver-5', 'suspended')$$, 'suspending a driver on a trip is accepted');
select is((select approval::text || '/' || suspend_after_trip from drivers where id = 'driver-5'), 'approved/true', 'a driver on a trip is suspended when the trip ends');
select throws_ok($$select review_document('driver', 'driver-11', 'criminal_record', 'approve')$$, '42501', null, 'firm admin cannot approve documents');
select throws_ok($$select set_firm_fee('firm-1', 10)$$, '42501', null, 'firm admin cannot change the platform fee');
select lives_ok($$select set_firm_rates('firm-1', 9000, null)$$, 'firm admin sets their own hire rates');
select throws_ok($$select set_firm_rates('firm-2', 9000, null)$$, '42501', null, 'firm admin cannot set another firm''s rates');

-- ── Company admins (rule b) ──
select pg_temp.act_as('admin-4'); -- co-1
select is((select count(*)::int from trips where not (company_id = 'co-1' and (payment_method = 'company_account' or type = 'shared_commute'))), 0, 'rule b: only company-billed trips and shared seats');
select ok(exists (select 1 from trips where id = 'FLT-2400'), 'rule b: the company sees its shared commute seat');
select ok(not exists (select 1 from trips where id = 'FLT-2401'), 'rule b: a staff member''s own MoMo ride stays private');
select is((select count(*)::int from riders where company_id is distinct from 'co-1'), 0, 'company admin sees only their staff');
select is((select count(*)::int from company_invoices where company_id <> 'co-1' or status = 'draft'), 0, 'company admin sees only their own sent invoices');
select is((select count(*)::int from documents), 0, 'company admin sees no driver documents');
select is((select count(*)::int from fee_invoices), 0, 'company admin sees no firm fee invoices');

-- Dispatch: the open queue is for platform admins; firm admins reassign trips already given to their firm.
select pg_temp.act_as('admin-2'); -- firm-1
select throws_ok($$select assign_driver('FLT-2436', 'driver-4')$$, '42501', null, 'firm admin cannot dispatch from the open queue');
select throws_ok($$select reassign_driver('FLT-2434', 'driver-4')$$, '42501', null, 'firm admin cannot take another firm''s trip');
select lives_ok($$select reassign_driver('FLT-2435', 'driver-4')$$, 'firm admin reassigns their own firm''s trip to their own driver');
select pg_temp.act_as('admin-1');
select lives_ok($$select assign_driver('FLT-2437', 'driver-8')$$, 'platform admin dispatches from the open queue');
-- ── Storage: document files ──
select pg_temp.act_as('driver-3');
select ok(app.can_read_document_file('driver-3/driving_licence/scan.pdf'), 'driver can open their own document file');
select ok(not app.can_read_document_file('driver-4/driving_licence/scan.pdf'), 'driver cannot open another driver''s file');
select pg_temp.act_as('admin-3'); -- firm-2
select ok(not app.can_read_document_file('driver-3/driving_licence/scan.pdf'), 'firm admin cannot open another firm''s driver file');
select ok(app.can_read_document_file('driver-8/driving_licence/scan.pdf'), 'firm admin can open their own driver''s file');
select pg_temp.act_as('admin-4');
select ok(not app.can_read_document_file('driver-3/driving_licence/scan.pdf'), 'company admin cannot open document files');
select pg_temp.act_as('admin-1');
select ok(app.can_read_document_file('driver-3/driving_licence/scan.pdf'), 'platform admin can open document files');
select pg_temp.as_runner();
select is((select public from storage.buckets where id = 'documents'), false, 'the documents bucket is private');
-- ── Map first: what a signed-out visitor (anon) can see ──
select set_config('role', 'anon', true);
select lives_ok($$select * from public.free_cars()$$, 'anon can list free cars');
select ok((select count(*) from public.free_cars()) > 0, 'there are free cars on the map');
select ok(not exists (select 1 from jsonb_array_elements(public.quote_firms()) firm where firm ? 'tin' or firm ? 'momo_merchant_code' or firm ? 'airtel_merchant_code'), 'quote_firms leaves out TIN and merchant codes');
select throws_ok($$select count(*) from public.firms$$, '42501', null, 'anon still cannot read the firms table');
select pg_temp.as_runner();
select is((select count(*)::int from public.free_cars()), (select count(*)::int from drivers d join cars c on c.id = d.car_id and c.availability = 'available' join firms f on f.id = d.firm_id and f.status = 'active' where d.approval = 'approved' and d.status = 'online'), 'free cars are exactly the approved, online drivers with a free car in an active firm');
select * from finish();
rollback;
