-- Flats are now added from a link only, so some details may be unknown at first.
-- Paste into Supabase → SQL Editor → Run (after 0002_more_details.sql).

alter table public.listings
  alter column rent drop not null,
  alter column area drop not null,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists image_url text check (image_url is null or image_url ~* '^https?://');
