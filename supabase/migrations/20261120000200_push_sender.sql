-- Browser push (Web Push with VAPID keys, free). When a notification is saved for someone with a browser push
-- subscription, Postgres asks the push function (supabase/functions/push) to send it. pg_net makes the call
-- after the transaction commits, so a slow push never holds up a trip.
create extension if not exists pg_net with schema extensions;

-- Where the push function is and the shared secret it checks. In the app schema, which the API does not expose.
-- One row; empty means push is off (in-app and open-tab notifications still work).
create table app.push_settings (
  id boolean primary key default true check (id),
  function_url text not null,
  secret text not null
);
revoke all on app.push_settings from public, anon, authenticated;

create function app.on_notification_push() returns trigger language plpgsql security definer set search_path = '' as $$
declare cfg app.push_settings;
begin
  select * into cfg from app.push_settings where id;
  if not found then return new; end if;
  if not exists (select 1 from public.push_subscriptions where auth_user_id = new.auth_user_id) then return new; end if;
  perform net.http_post(
    url := cfg.function_url,
    body := jsonb_build_object('notification_id', new.id),
    headers := jsonb_build_object('content-type', 'application/json', 'x-flyt-push-secret', cfg.secret),
    timeout_milliseconds := 5000
  );
  return new;
exception when others then
  -- Push is best effort: never fail the notification (or the trip change behind it).
  return new;
end $$;
create trigger notifications_push after insert on public.notifications for each row execute function app.on_notification_push();
revoke execute on function app.on_notification_push() from public, anon, authenticated;
