-- Invoices, worked out in Postgres (same rules as lib/invoices.ts).
-- A fee invoice counts a firm's completed trips in the period (by completion time, Kigali month).
-- A company invoice counts completed trips billed to the company in the period. A voided trip (fare 0) is not billed.
-- Drafts are recalculated; sent and paid invoices never change. A correction to a trip on a sent invoice goes on
-- the next invoice made for that firm or company as an adjustment line: [{tripId, fromPeriod, fare, fee, reason}].

/**
 * Adjustment lines for an invoice in p_period. p_trips: the holder's trips (firm or company). p_others: the holder's
 * other invoices as jsonb [{period, status, lines, adjustments}], not the one being made.
 */
create function app.adjustments_for(p_trip_ids text[], p_period text, p_others jsonb) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  t public.trips;
  origin jsonb;
  billed_fare integer;
  billed_fee integer;
  result jsonb := '[]';
begin
  for t in select * from public.trips where id = any (p_trip_ids) and status = 'completed' and completed_at is not null and app.kigali_month(completed_at) < p_period order by id loop
    select inv into origin from jsonb_array_elements(p_others) inv
    where inv->>'period' < p_period and inv->>'status' in ('sent', 'paid')
      and exists (select 1 from jsonb_array_elements(inv->'lines') l where l->>'tripId' = t.id)
    order by inv->>'period' limit 1;
    continue when origin is null;
    select coalesce(sum((l->>'fare')::integer), 0), coalesce(sum((l->>'fee')::integer), 0) into billed_fare, billed_fee
    from jsonb_array_elements(p_others) inv, jsonb_array_elements((inv->'lines') || (inv->'adjustments')) l
    where l->>'tripId' = t.id;
    if t.fare - billed_fare <> 0 or t.platform_fee - billed_fee <> 0 then
      result := result || jsonb_build_array(jsonb_build_object('tripId', t.id, 'fromPeriod', origin->>'period', 'fare', t.fare - billed_fare, 'fee', t.platform_fee - billed_fee,
        'reason', coalesce(t.corrections -> -1 ->> 'reason', 'Fare corrected')));
    end if;
  end loop;
  return result;
end $$;

create function app.lines_for(p_trip_ids text[], p_period text) returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('tripId', id, 'fare', fare, 'fee', platform_fee) order by completed_at, id), '[]')
  from public.trips where id = any (p_trip_ids) and status = 'completed' and completed_at is not null and app.kigali_month(completed_at) = p_period and fare > 0
$$;

create function app.sum_of(p_rows jsonb, p_key text) returns integer language sql immutable as $$
  select coalesce(sum((r->>p_key)::integer), 0)::integer from jsonb_array_elements(p_rows) r
$$;

/** Creates or refreshes the drafts for a period. Works for the current month and earlier. Returns {period, created, refreshed}. */
create function app.build_invoices(p_period text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  f public.firms;
  c public.companies;
  existing record;
  ids text[];
  others jsonb;
  v_lines jsonb;
  v_adj jsonb;
  created integer := 0;
  refreshed integer := 0;
begin
  if p_period !~ '^\d{4}-(0[1-9]|1[0-2])$' or p_period > app.kigali_month(now()) then raise exception 'Pick this month or an earlier month'; end if;
  for f in select * from public.firms order by id loop
    select id, status into existing from public.fee_invoices where firm_id = f.id and period = p_period for update;
    continue when found and existing.status <> 'draft';
    ids := array(select id from public.trips where firm_id = f.id);
    others := coalesce((select jsonb_agg(jsonb_build_object('period', period, 'status', status, 'lines', fee_invoices.lines, 'adjustments', fee_invoices.adjustments))
                        from public.fee_invoices where firm_id = f.id and period <> p_period), '[]');
    v_lines := app.lines_for(ids, p_period);
    v_adj := app.adjustments_for(ids, p_period, others);
    if existing.id is not null then
      update public.fee_invoices set trip_count = jsonb_array_length(v_lines),
        fares_total = app.sum_of(v_lines, 'fare') + app.sum_of(v_adj, 'fare'), fee_total = app.sum_of(v_lines, 'fee') + app.sum_of(v_adj, 'fee'),
        lines = v_lines, adjustments = v_adj
      where id = existing.id;
      refreshed := refreshed + 1;
    elsif f.status = 'active' and (jsonb_array_length(v_lines) > 0 or jsonb_array_length(v_adj) > 0) then
      insert into public.fee_invoices (id, firm_id, period, trip_count, fares_total, fee_total, status, lines, adjustments)
      values ('FI-' || p_period || '-' || f.id, f.id, p_period, jsonb_array_length(v_lines), app.sum_of(v_lines, 'fare') + app.sum_of(v_adj, 'fare'),
              app.sum_of(v_lines, 'fee') + app.sum_of(v_adj, 'fee'), 'draft', v_lines, v_adj);
      created := created + 1;
    end if;
    existing := null;
  end loop;
  for c in select * from public.companies order by id loop
    select id, status into existing from public.company_invoices where company_id = c.id and period = p_period for update;
    continue when found and existing.status <> 'draft';
    ids := array(select id from public.trips where company_id = c.id and payment_method = 'company_account');
    others := coalesce((select jsonb_agg(jsonb_build_object('period', period, 'status', status, 'lines', company_invoices.lines, 'adjustments', company_invoices.adjustments))
                        from public.company_invoices where company_id = c.id and period <> p_period), '[]');
    v_lines := app.lines_for(ids, p_period);
    v_adj := app.adjustments_for(ids, p_period, others);
    if existing.id is not null then
      update public.company_invoices set trip_count = jsonb_array_length(v_lines), total = app.sum_of(v_lines, 'fare') + app.sum_of(v_adj, 'fare'),
        lines = v_lines, adjustments = v_adj
      where id = existing.id;
      refreshed := refreshed + 1;
    elsif jsonb_array_length(v_lines) > 0 or jsonb_array_length(v_adj) > 0 then
      insert into public.company_invoices (id, company_id, period, trip_count, total, status, lines, adjustments)
      values ('CI-' || p_period || '-' || c.id, c.id, p_period, jsonb_array_length(v_lines), app.sum_of(v_lines, 'fare') + app.sum_of(v_adj, 'fare'), 'draft', v_lines, v_adj);
      created := created + 1;
    end if;
    existing := null;
  end loop;
  return jsonb_build_object('period', p_period, 'created', created, 'refreshed', refreshed);
end $$;

create function public.generate_invoices(p_period text) returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform app.require_platform();
  return app.build_invoices(p_period);
end $$;

/** Invoices only move forward: draft → sent → paid. p_kind: 'fee' or 'company'. */
create function public.set_invoice_status(p_kind text, p_invoice text, p_status public.invoice_status) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  current_status public.invoice_status;
  row_json jsonb;
begin
  perform app.require_platform();
  if p_kind = 'fee' then select status into current_status from public.fee_invoices where id = p_invoice for update;
  else select status into current_status from public.company_invoices where id = p_invoice for update; end if;
  if current_status is null then raise exception 'Invoice not found'; end if;
  if not ((current_status = 'draft' and p_status = 'sent') or (current_status = 'sent' and p_status = 'paid')) then
    raise exception 'Invoices move from draft to sent to paid';
  end if;
  if p_kind = 'fee' then update public.fee_invoices set status = p_status where id = p_invoice returning to_jsonb(fee_invoices.*) into row_json;
  else update public.company_invoices set status = p_status where id = p_invoice returning to_jsonb(company_invoices.*) into row_json; end if;
  return row_json;
end $$;

/**
 * Platform admins correct a completed trip's fare (0 voids it), with a reason kept on the trip.
 * The platform fee follows at the rate the trip was booked at. Sent invoices stay as they are.
 */
create function public.correct_trip_fare(p_trip text, p_fare integer, p_reason text) returns public.trips language plpgsql security definer set search_path = '' as $$
declare
  t public.trips;
  pct integer;
begin
  perform app.require_platform();
  select * into t from public.trips where id = p_trip for update;
  if not found then raise exception 'Trip not found'; end if;
  if t.status <> 'completed' then raise exception 'Only a completed trip''s fare can be corrected'; end if;
  if p_fare is null or p_fare < 0 then raise exception 'The fare must be a whole Rwf amount (0 voids the trip)'; end if;
  if p_fare = t.fare then raise exception 'The fare is already this amount'; end if;
  if nullif(trim(p_reason), '') is null then raise exception 'Give a reason for the correction'; end if;
  pct := coalesce((t.corrections -> 0 ->> 'feePercent')::integer, case when t.fare > 0 then round(t.platform_fee * 100.0 / t.fare)::integer else 0 end);
  update public.trips set
    corrections = corrections || jsonb_build_array(jsonb_build_object('at', now(), 'byAdminId', app.admin_id(), 'fromFare', t.fare, 'toFare', p_fare, 'reason', left(trim(p_reason), 200), 'feePercent', pct)),
    fare = p_fare, platform_fee = public.platform_fee(p_fare, pct), updated_at = now()
  where id = p_trip returning * into t;
  return t;
end $$;
