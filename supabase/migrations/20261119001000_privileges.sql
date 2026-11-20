-- Least privilege for helper functions. The app schema is not exposed through the API, but helpers that change
-- data (move_trip, attach, release, notify...) still must not be callable by signed-in users from SQL.
-- Only the read helpers that RLS policies call as the signed-in person stay executable.
revoke execute on all functions in schema app from public, anon, authenticated;
grant execute on function
  app.rider_id(), app.driver_id(), app.is_platform(), app.admin_firm(), app.admin_company(), app.admin_id(),
  app.is_company_trip(public.trips, text), app.chat_role(public.trips, text), app.can_read_document_file(text), app.phone_key(text)
to authenticated;
-- New functions in the app schema are not executable by default either.
alter default privileges in schema app revoke execute on functions from public;
