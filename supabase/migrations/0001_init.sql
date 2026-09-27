-- Flatmate Finder — full database setup.
-- Paste this whole file into Supabase → SQL Editor → Run. It is safe to run once on a new project.

-- ─────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  email text,
  created_at timestamptz not null default now()
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  invite_code text not null unique default upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8)),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- user_id is unique: one group per person. The 3-person limit is enforced in join_group().
create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null unique references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

-- One row per person. `criteria` holds the flat-feature rules, e.g.
-- {"lift": {"importance": "hard"}, "min_bathrooms": {"importance": "nice", "weight": 4, "value": 2}}
create table public.preferences (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  max_rent_share integer check (max_rent_share > 0),
  max_deposit_share integer check (max_deposit_share > 0),
  excluded_areas text[] not null default '{}',
  criteria jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

-- Places a person travels to (office, gym, family…) with a maximum travel time.
create table public.places (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 80),
  max_minutes integer not null check (max_minutes between 1 and 300),
  importance text not null default 'hard' check (importance in ('hard', 'nice')),
  weight integer not null default 3 check (weight between 1 and 5),
  created_at timestamptz not null default now()
);

-- Manually entered flats. NULL in a yes/no column means "not known yet".
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  added_by uuid references auth.users (id) on delete set null,
  title text not null check (char_length(title) between 1 and 120),
  area text not null,
  address text,
  source_url text check (source_url is null or source_url ~* '^https?://'),
  rent integer not null check (rent > 0),
  deposit integer check (deposit >= 0),
  bedrooms integer check (bedrooms between 0 and 10),
  bathrooms integer check (bathrooms between 0 and 10),
  floor integer check (floor between -2 and 100),
  has_lift boolean,
  parking boolean,
  pet_friendly boolean,
  furnishing text check (furnishing in ('unfurnished', 'semi', 'furnished')),
  sharing_allowed boolean,
  available_from date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Travel time (minutes) from a flat to one person's place. Typed in by any roommate.
create table public.travel_times (
  listing_id uuid not null references public.listings (id) on delete cascade,
  place_id uuid not null references public.places (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  minutes integer not null check (minutes between 0 and 600),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (listing_id, place_id)
);

create table public.votes (
  listing_id uuid not null references public.listings (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  vote text not null check (vote in ('shortlist', 'discuss', 'reject')),
  updated_at timestamptz not null default now(),
  primary key (listing_id, user_id)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index on public.places (group_id);
create index on public.listings (group_id);
create index on public.travel_times (group_id);
create index on public.votes (group_id);
create index on public.comments (listing_id);

-- ─────────────────────────────────────────────────────────────
-- Helper functions (security definer = they can look at group_members without tripping RLS)
-- ─────────────────────────────────────────────────────────────

create or replace function public.is_member(g uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from group_members where group_id = g and user_id = auth.uid());
$$;

create or replace function public.shares_group(other uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from group_members a join group_members b on a.group_id = b.group_id
    where a.user_id = auth.uid() and b.user_id = other
  );
$$;

create or replace function public.listing_in_group(l uuid, g uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from listings where id = l and group_id = g);
$$;

create or replace function public.place_in_group(p uuid, g uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from places where id = p and group_id = g);
$$;

-- Create a profile automatically when someone signs in with Google for the first time.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name, avatar_url, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url',
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger listings_touch before update on public.listings
  for each row execute function public.touch_updated_at();
create trigger preferences_touch before update on public.preferences
  for each row execute function public.touch_updated_at();
create trigger votes_touch before update on public.votes
  for each row execute function public.touch_updated_at();
create trigger travel_times_touch before update on public.travel_times
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Group actions (the only way to create, join or leave a group)
-- ─────────────────────────────────────────────────────────────

create or replace function public.create_group(group_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  new_id uuid;
begin
  if auth.uid() is null then raise exception 'Please sign in first.'; end if;
  if exists (select 1 from group_members where user_id = auth.uid()) then
    raise exception 'You are already in a group. Leave it first to create a new one.';
  end if;
  insert into groups (name, created_by) values (trim(group_name), auth.uid()) returning id into new_id;
  insert into group_members (group_id, user_id) values (new_id, auth.uid());
  return new_id;
end;
$$;

create or replace function public.join_group(code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  g_id uuid;
  member_count integer;
begin
  if auth.uid() is null then raise exception 'Please sign in first.'; end if;
  -- "for update" locks the group row so two people can't both become the 3rd member at once.
  select id into g_id from groups where invite_code = upper(trim(code)) for update;
  if g_id is null then raise exception 'That invite code does not exist.'; end if;
  if exists (select 1 from group_members where user_id = auth.uid() and group_id = g_id) then
    return g_id;
  end if;
  if exists (select 1 from group_members where user_id = auth.uid()) then
    raise exception 'You are already in another group. Leave it first.';
  end if;
  select count(*) into member_count from group_members where group_id = g_id;
  if member_count >= 3 then raise exception 'This group already has 3 roommates.'; end if;
  insert into group_members (group_id, user_id) values (g_id, auth.uid());
  return g_id;
end;
$$;

-- Leaving removes your preferences, places and votes. Listings and comments you wrote stay.
create or replace function public.leave_group()
returns void language plpgsql security definer set search_path = public as $$
declare
  g_id uuid;
begin
  select group_id into g_id from group_members where user_id = auth.uid();
  if g_id is null then return; end if;
  delete from votes where group_id = g_id and user_id = auth.uid();
  delete from places where group_id = g_id and user_id = auth.uid();
  delete from preferences where group_id = g_id and user_id = auth.uid();
  delete from group_members where group_id = g_id and user_id = auth.uid();
  if not exists (select 1 from group_members where group_id = g_id) then
    delete from groups where id = g_id;
  end if;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- Row Level Security: who can see and change what
-- ─────────────────────────────────────────────────────────────

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.preferences enable row level security;
alter table public.places enable row level security;
alter table public.listings enable row level security;
alter table public.travel_times enable row level security;
alter table public.votes enable row level security;
alter table public.comments enable row level security;

-- Profiles: see yourself and your roommates; edit only yourself.
create policy "profiles_select" on public.profiles for select to authenticated
  using (id = auth.uid() or shares_group(id));
create policy "profiles_update" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Groups and members: visible to members only. Changes go through the functions above.
create policy "groups_select" on public.groups for select to authenticated
  using (is_member(id));
create policy "groups_update" on public.groups for update to authenticated
  using (is_member(id)) with check (is_member(id));
create policy "members_select" on public.group_members for select to authenticated
  using (is_member(group_id));

-- Preferences and places: roommates can read; only the owner can write.
create policy "prefs_select" on public.preferences for select to authenticated
  using (is_member(group_id));
create policy "prefs_insert" on public.preferences for insert to authenticated
  with check (user_id = auth.uid() and is_member(group_id));
create policy "prefs_update" on public.preferences for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and is_member(group_id));

create policy "places_select" on public.places for select to authenticated
  using (is_member(group_id));
create policy "places_insert" on public.places for insert to authenticated
  with check (user_id = auth.uid() and is_member(group_id));
create policy "places_update" on public.places for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and is_member(group_id));
create policy "places_delete" on public.places for delete to authenticated
  using (user_id = auth.uid());

-- Listings: every roommate can add, edit and delete.
create policy "listings_select" on public.listings for select to authenticated
  using (is_member(group_id));
create policy "listings_insert" on public.listings for insert to authenticated
  with check (is_member(group_id) and added_by = auth.uid());
create policy "listings_update" on public.listings for update to authenticated
  using (is_member(group_id)) with check (is_member(group_id));
create policy "listings_delete" on public.listings for delete to authenticated
  using (is_member(group_id));

-- Travel times: any roommate can fill them in, as long as flat and place are in the same group.
create policy "travel_select" on public.travel_times for select to authenticated
  using (is_member(group_id));
create policy "travel_insert" on public.travel_times for insert to authenticated
  with check (is_member(group_id) and listing_in_group(listing_id, group_id) and place_in_group(place_id, group_id));
create policy "travel_update" on public.travel_times for update to authenticated
  using (is_member(group_id))
  with check (is_member(group_id) and listing_in_group(listing_id, group_id) and place_in_group(place_id, group_id));
create policy "travel_delete" on public.travel_times for delete to authenticated
  using (is_member(group_id));

-- Votes: everyone sees all votes; you can only cast or change your own.
create policy "votes_select" on public.votes for select to authenticated
  using (is_member(group_id));
create policy "votes_insert" on public.votes for insert to authenticated
  with check (user_id = auth.uid() and is_member(group_id) and listing_in_group(listing_id, group_id));
create policy "votes_update" on public.votes for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and is_member(group_id) and listing_in_group(listing_id, group_id));
create policy "votes_delete" on public.votes for delete to authenticated
  using (user_id = auth.uid());

-- Comments: roommates read; you write and delete your own.
create policy "comments_select" on public.comments for select to authenticated
  using (is_member(group_id));
create policy "comments_insert" on public.comments for insert to authenticated
  with check (user_id = auth.uid() and is_member(group_id) and listing_in_group(listing_id, group_id));
create policy "comments_delete" on public.comments for delete to authenticated
  using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- Permissions for the app's API (signed-in users only; RLS above still applies)
-- ─────────────────────────────────────────────────────────────

revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;

revoke execute on all functions in schema public from public, anon;
grant execute on function public.create_group(text), public.join_group(text), public.leave_group(),
  public.is_member(uuid), public.shares_group(uuid), public.listing_in_group(uuid, uuid),
  public.place_in_group(uuid, uuid)
  to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Real-time updates
-- ─────────────────────────────────────────────────────────────

alter table public.group_members replica identity full;
alter table public.votes replica identity full;
alter table public.travel_times replica identity full;
alter table public.places replica identity full;
alter table public.comments replica identity full;
alter table public.listings replica identity full;

alter publication supabase_realtime add table
  public.group_members, public.groups, public.preferences, public.places,
  public.listings, public.travel_times, public.votes, public.comments;
