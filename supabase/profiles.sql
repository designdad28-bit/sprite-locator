-- Run once in the Supabase SQL Editor. This is DDL, which the app's public
-- key can never do (by design — see lib/supabase.ts) even after this file
-- exists, so it has to be pasted in by hand.
--
-- A profile can be signed in with Epic, Discord, or both — see
-- app/api/auth/epic/callback and app/api/auth/discord/callback. Both
-- provider id columns are nullable; the CHECK constraint is what still
-- guarantees a row has at least one of them actually linked.

create table public.profiles (
  id                    uuid primary key default gen_random_uuid(),
  epic_account_id       text unique,
  epic_display_name     text,
  discord_account_id    text unique,
  discord_display_name  text,
  discord_avatar_url    text,
  created_at            timestamptz not null default now(),

  constraint profiles_has_a_provider
    check (epic_account_id is not null or discord_account_id is not null)
);

alter table public.profiles enable row level security;

-- Profiles are written only by the server (via the service-role key in
-- app/api/auth/epic/callback and app/api/auth/discord/callback), which
-- bypasses RLS entirely — these policies govern what a signed-in BROWSER may
-- do directly against the table. A player may read and rename only their own
-- row; nothing else.
create policy "read own profile"
  on public.profiles for select
  using (id = auth.uid());

create policy "update own display name"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- Optional, once you're ready to scope findings to whoever logged them:
--
--   alter table public.sprite_locations add column user_id uuid references public.profiles(id);
--
--   create policy "public read" on public.sprite_locations for select using (true);
--   -- keeps findings visible to everyone, logged-in or not
--
--   drop policy "public insert" on public.sprite_locations;
--   create policy "insert own finding" on public.sprite_locations
--     for insert with check (user_id = auth.uid());
--   -- requires a session; anonymous inserts stop working, so decide first
--   -- whether findings should still be loggable while signed out
