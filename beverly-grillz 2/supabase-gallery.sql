-- ============================================================
-- Beverly Grillz — Camp Gallery storage
-- ============================================================
-- Run this ONCE in your Supabase project's SQL Editor.
-- Dashboard → SQL Editor → New query → paste this → Run.
--
-- Until this runs, the gallery on the Resources tab still renders (it reads
-- its metadata from kv_store, which already exists) -- but picking a file
-- fails with "the gallery storage bucket does not exist yet".
--
-- What it does: creates a public bucket called "gallery" and allows the
-- site to read, add, and remove images in it. Image metadata and votes
-- live in the kv_store table from supabase-schema.sql, not here.

-- ------------------------------------------------------------
-- 1. The bucket
-- ------------------------------------------------------------
-- public = true means images have a plain URL anyone can load, which is
-- what lets them render in an <img> tag without signing every request.
-- 25MB ceiling matches the limit the upload form enforces.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'gallery',
  'gallery',
  true,
  26214400,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ------------------------------------------------------------
-- 2. Access policies
-- ------------------------------------------------------------
-- Same trust model as the rest of the app: the site password is the gate.
-- Anyone holding the anon key (it ships in the browser bundle) can write
-- here, so treat this bucket as public and don't put anything sensitive
-- in it. Scoped to bucket_id = 'gallery' so no other bucket is affected.

drop policy if exists "gallery read"   on storage.objects;
drop policy if exists "gallery insert" on storage.objects;
drop policy if exists "gallery delete" on storage.objects;

create policy "gallery read"   on storage.objects for select using      (bucket_id = 'gallery');
create policy "gallery insert" on storage.objects for insert with check (bucket_id = 'gallery');
create policy "gallery delete" on storage.objects for delete using      (bucket_id = 'gallery');
