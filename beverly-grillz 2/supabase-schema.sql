-- ============================================================
-- Beverly Grillz — Supabase schema
-- ============================================================
-- Run this once in your Supabase project's SQL Editor.
-- Dashboard → SQL Editor → New query → paste this → Run.

-- A simple key/value table that mirrors how the app already stores data.
create table if not exists public.kv_store (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);

-- Enable Row Level Security (required by Supabase by default).
alter table public.kv_store enable row level security;

-- Public access: the app's password gate is the access control.
-- Anyone with the anon key (which is in the client bundle) can read/write.
-- This is fine for a friends-and-family event; not fine for sensitive data.

drop policy if exists "public read"   on public.kv_store;
drop policy if exists "public insert" on public.kv_store;
drop policy if exists "public update" on public.kv_store;
drop policy if exists "public delete" on public.kv_store;

create policy "public read"   on public.kv_store for select using (true);
create policy "public insert" on public.kv_store for insert with check (true);
create policy "public update" on public.kv_store for update using (true);
create policy "public delete" on public.kv_store for delete using (true);
