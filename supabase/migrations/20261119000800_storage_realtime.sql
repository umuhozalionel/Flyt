-- Private storage for document files (ID, criminal record certificate...). Never public.
-- Path: <driver id>/<document type>/<file name>. Only the driver, their firm admin and platform admins can read a file,
-- and the app opens it through a signed link that lasts 60 seconds. Only the driver can upload to their own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create function app.can_read_document_file(p_name text) returns boolean language sql stable security definer set search_path = '' as $$
  select app.is_platform()
    or coalesce(split_part(p_name, '/', 1) = app.driver_id(), false)
    or exists (select 1 from public.drivers d where d.id = split_part(p_name, '/', 1) and d.firm_id = app.admin_firm())
$$;

create policy "document files: read" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and app.can_read_document_file(name));
create policy "document files: driver uploads to own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and split_part(name, '/', 1) = app.driver_id());

-- Live updates for the screens that must react at once: trips, job offers and drivers.
-- Realtime applies the same RLS, so each person only receives rows they may read.
alter publication supabase_realtime add table public.trips, public.job_offers, public.drivers;
