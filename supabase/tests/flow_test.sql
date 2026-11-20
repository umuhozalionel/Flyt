-- Trip rules, money and the Phase 6 additions, run through the RPC functions as real roles.
begin;
create extension if not exists pgtap with schema extensions;
select plan(52);

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

-- ── Blocked status moves ──
select pg_temp.act_as('driver-3'); -- FLT-2433 is driver_arrived
select throws_ok($$select end_trip('FLT-2433')$$, 'P0001', 'A trip cannot move from driver_arrived to completed', 'driver_arrived → completed is blocked');
select throws_ok($$select driver_arrived((select id from trips where driver_id = 'driver-3' and status = 'completed' limit 1))$$, 'P0001', null, 'a completed trip cannot move again');
select throws_ok($$select start_trip('FLT-2431', '0000')$$, '42501', null, 'a driver cannot move another driver''s trip');
select pg_temp.act_as('rider-1');
select throws_ok($$select cancel_trip((select id from trips where rider_id = 'rider-1' and status = 'completed' limit 1), 'Changed my mind')$$, 'P0001', null, 'a completed trip cannot be cancelled');
select throws_ok($$select cancel_trip('FLT-2436', 'x')$$, '42501', null, 'a rider cannot cancel someone else''s trip');

-- ── Trip PIN ──
select pg_temp.act_as('driver-3');
select is(start_trip('FLT-2433', '99999'), null, 'a wrong PIN does not start the trip');
select pg_temp.as_runner();
select is((select wrong_tries from trip_pins where trip_id = 'FLT-2433'), 1, 'the wrong try is counted');
select pg_temp.act_as('rider-16');
select ok((select pin from trip_pins where trip_id = 'FLT-2433') ~ '^\d{4}$', 'the rider can read their 4-digit PIN');
select pg_temp.as_runner();
create temp table pin as select pin from trip_pins where trip_id = 'FLT-2433';
grant select on pin to authenticated;
select pg_temp.act_as('driver-3');
select is((select status::text from start_trip('FLT-2433', (select pin from pin))), 'in_progress', 'the right PIN starts the trip and writes started_at');
select ok((select started_at is not null from trips where id = 'FLT-2433'), 'started_at is written');

-- ── Chat: rider and driver (rule c), company and driver (rule b) ──
select lives_ok($$select send_chat('FLT-2433', 'rider_driver', '2 minutes', true)$$, 'driver can chat on their active trip');
select throws_ok($$select send_chat('FLT-2433', 'rider_driver', 'Call me on 0788 123 456')$$, 'P0001', 'Phone numbers cannot be sent in chat', 'no phone numbers in chat');
select throws_ok($$select send_chat('FLT-2433', 'rider_driver', 'Call 078-812-3456')$$, 'P0001', 'Phone numbers cannot be sent in chat', 'no phone numbers even with dashes');
select pg_temp.act_as('rider-16');
select lives_ok($$select send_chat('FLT-2433', 'rider_driver', 'I''m at the gate', true)$$, 'rider can chat on their active trip');
select is((select count(*)::int from chat_messages where trip_id = 'FLT-2433'), 2, 'rider reads the trip chat');
select throws_ok($$select send_chat('FLT-2433', 'company_driver', 'hello')$$, '42501', null, 'rider cannot use the company channel');
select pg_temp.act_as('rider-1');
select is((select count(*)::int from chat_messages), 0, 'another rider reads no chat');
select throws_ok($$select send_chat((select id from trips where rider_id = 'rider-1' and status = 'completed' limit 1), 'rider_driver', 'hi')$$, 'P0001', 'Chat is closed for this trip', 'chat is closed after the trip');
select pg_temp.act_as('admin-4'); -- co-1
select throws_ok($$select send_chat('FLT-2433', 'company_driver', 'hello')$$, '42501', null, 'rule b: a company cannot chat on a trip it is not billed for');
select is((select count(*)::int from chat_messages), 0, 'rule b: a company reads no chat on other trips');
select pg_temp.act_as('admin-2');
select is((select count(*)::int from chat_messages), 0, 'a firm admin does not read rider chats');

-- ── Live sharing link ──
select pg_temp.act_as('rider-16');
create temp table share (token text);
grant all on share to authenticated, anon;
insert into share select create_trip_share('FLT-2433');
select pg_temp.as_runner();
set local role anon;
select is((shared_trip((select token from share)) ->> 'status'), 'in_progress', 'the link works without sign-in while the trip is on');
select ok(shared_trip((select token from share))::text !~ '\+250', 'the shared page shows no phone numbers');
select is(shared_trip('not-a-token'), null, 'a wrong token shows nothing');
select pg_temp.act_as('driver-3');
select lives_ok($$select end_trip('FLT-2433')$$, 'trip ends');
select pg_temp.as_runner();
set local role anon;
select is(shared_trip((select token from share)), null, 'the link stops working when the trip ends');
select pg_temp.as_runner();
select is((select count(*)::int from trip_shares where trip_id = 'FLT-2433' and revoked_at is not null), 1, 'the link is revoked at trip end');

-- ── Notifications and reward points from the trip above ──
select ok(exists (select 1 from notifications n join riders r on r.auth_user_id = n.auth_user_id where r.id = 'rider-16' and n.type = 'receipt_ready'), 'rider gets "receipt ready"');
select ok(exists (select 1 from notifications n join riders r on r.auth_user_id = n.auth_user_id where r.id = 'rider-16' and n.type = 'trip_started'), 'rider gets "trip started"');
-- Fare of FLT-2433 (Nyabugogo → Gisozi, 4 km, Test plan): 1,200 + 3 × 750 = 3,450 → 3 full thousands → 3 points.
select is((select fare from trips where id = 'FLT-2433'), 3450, 'fare is the Test-plan price');
select is((select points from reward_points where trip_id = 'FLT-2433'), 3, 'reward points: 1 per full Rwf 1,000, fare unchanged');
select pg_temp.act_as('rider-16');
select lives_ok($$select set_notification_mute('trip_started', true)$$, 'a rider can mute a notification type');
select is((select count(*)::int from notifications n where n.auth_user_id <> auth.uid()), 0, 'people only read their own notifications');

-- ── Lost and found: incident, chat reopens 24 hours ──
select lives_ok($$select report_lost_item('FLT-2433', 'Blue umbrella')$$, 'rider reports a lost item');
select lives_ok($$select send_chat('FLT-2433', 'rider_driver', 'Did you find a blue umbrella?')$$, 'chat reopens after the report');
select pg_temp.as_runner();
select is((select type::text from incidents i join lost_items l on l.incident_id = i.id where l.trip_id = 'FLT-2433'), 'lost_item', 'an incident is opened');

-- ── Tips: off by default, drivers opt in, straight to the driver's own MoMo number ──
select pg_temp.act_as('admin-2');
select lives_ok($$select set_firm_tips('firm-1', true)$$, 'the firm turns tips on');
select pg_temp.act_as('rider-16');
select is(tip_details('FLT-2433'), null, 'no tips until the driver opts in');
select pg_temp.act_as('driver-3');
select throws_ok($$select set_tip_settings(true, null)$$, 'P0001', 'Add the MoMo number tips should go to', 'opting in needs a MoMo number');
select lives_ok($$select set_tip_settings(true, '0788 330 112')$$, 'driver opts in with their own MoMo number');
select pg_temp.act_as('rider-16');
select is((tip_details('FLT-2433') ->> 'momoNumber'), '+250 788 330 112', 'the rider gets the driver''s MoMo number on the tip screen');
select throws_ok($$select record_tip('FLT-2433', 10001)$$, 'P0001', 'A tip is from Rwf 1 to Rwf 10,000', 'tips are capped at Rwf 10,000');
select is((select amount from record_tip('FLT-2433', 1000)), 1000, 'the tip is recorded, Flyt holds nothing');
select throws_ok($$select record_tip('FLT-2433', 500)$$, 'P0001', 'You already tipped on this trip', 'one tip per trip');
select pg_temp.as_runner();
update trips set completed_at = now() - interval '25 hours' where id = 'FLT-2433';
select pg_temp.act_as('rider-16');
select is(tip_details('FLT-2433'), null, 'the MoMo number is hidden 24 hours after the trip');

-- ── Money in Postgres ──
select pg_temp.act_as('rider-20');
select is((select fare from create_booking('remera', 'kcc', 'private', 'momo')), 2700, 'booking fare from the server: 1,200 + 2 × 750 = 2,700');
select is((select platform_fee from trips where rider_id = 'rider-20' and status = 'requested' order by created_at desc limit 1), 324, 'platform fee 12% of 2,700 = 324');
select throws_ok($$select create_booking('remera', 'kcc', 'shared_commute', 'momo')$$, 'P0001', 'Only company staff can book this', 'only company staff can book a shared seat');

-- Invoice adjustment: correct a trip on a sent October invoice; November gets the difference.
select pg_temp.act_as('admin-1');
select lives_ok($$select correct_trip_fare((select (l->>'tripId') from fee_invoices, jsonb_array_elements(lines) l where id = 'FI-' || to_char(now() at time zone 'Africa/Kigali' - interval '1 month', 'YYYY-MM') || '-firm-1' limit 1), 0, 'Trip did not happen')$$, 'platform admin voids a trip on a paid invoice');
select pg_temp.as_runner();
create temp table before_inv as select fares_total from fee_invoices where id = 'FI-' || to_char(now() at time zone 'Africa/Kigali' - interval '1 month', 'YYYY-MM') || '-firm-1';
select pg_temp.act_as('admin-1');
select lives_ok($$select generate_invoices(to_char(now() at time zone 'Africa/Kigali', 'YYYY-MM'))$$, 'generate this month''s drafts');
select pg_temp.as_runner();
select is((select fares_total from fee_invoices where id = 'FI-' || to_char(now() at time zone 'Africa/Kigali' - interval '1 month', 'YYYY-MM') || '-firm-1'), (select fares_total from before_inv), 'the paid invoice did not change');
select is((select jsonb_array_length(adjustments) from fee_invoices where id = 'FI-' || to_char(now() at time zone 'Africa/Kigali', 'YYYY-MM') || '-firm-1'), 1, 'this month''s invoice carries one adjustment line');

select * from finish();
rollback;
