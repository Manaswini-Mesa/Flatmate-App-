-- More flat details and personal preferences.
-- Paste into Supabase → SQL Editor → Run (after 0001_init.sql).

alter table public.listings
  add column if not exists maintenance integer check (maintenance >= 0),     -- monthly, split 3 ways with rent
  add column if not exists brokerage integer check (brokerage >= 0),         -- one-time, split 3 ways with deposit
  add column if not exists non_veg_allowed boolean,
  add column if not exists guests_allowed boolean,
  add column if not exists no_curfew boolean,
  add column if not exists gated_security boolean,
  add column if not exists power_backup boolean,
  add column if not exists washing_machine boolean,
  add column if not exists air_conditioning boolean,
  add column if not exists balcony boolean;

-- About the person (shown to roommates, not used for matching).
alter table public.preferences
  add column if not exists diet text check (diet in ('veg', 'eggetarian', 'non_veg')),
  add column if not exists notes text check (char_length(notes) <= 1000);
