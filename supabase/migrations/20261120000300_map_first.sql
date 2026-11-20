-- Phase 6C, map first: the rider app opens on the map, and sign-in is asked only when the rider books.
-- Two read-only functions let a signed-out rider see nearby free cars and prices. No tables change.

-- Free cars on the map: an opaque key (changes each day) and the zone only. No driver, car or firm details.
create function public.free_cars() returns table (key text, zone text) language sql stable security definer set search_path = '' as $$
  select left(md5(d.id || ':' || current_date::text), 12), d.zone
  from public.drivers d
  join public.cars c on c.id = d.car_id and c.availability = 'available'
  join public.firms f on f.id = d.firm_id and f.status = 'active'
  where d.approval = 'approved' and d.status = 'online'
$$;

-- What the fare preview needs about active firms, for a rider who has not signed in yet. No TIN or merchant codes.
create function public.quote_firms() returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'name', name, 'type', type, 'rura_licence_no', rura_licence_no, 'fee_percent', fee_percent,
    'hourly_rate', hourly_rate, 'daily_rate', daily_rate, 'status', status
  ) order by created_at, id), '[]'::jsonb)
  from public.firms where status = 'active'
$$;

revoke execute on function public.free_cars(), public.quote_firms() from public;
grant execute on function public.free_cars(), public.quote_firms() to anon, authenticated;
