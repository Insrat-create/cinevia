create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.favorites (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  item_id text not null,
  item_type text not null,
  created_at timestamptz not null default now(),
  unique (user_id, item_id)
);

create table if not exists public.continue_watching (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  item_id text not null,
  item_type text not null,
  progress integer not null default 0,
  resume_time_seconds double precision not null default 0,
  duration_seconds double precision not null default 0,
  episode_id text,
  last_watched_at timestamptz not null default now(),
  unique (user_id, item_id)
);

alter table public.continue_watching
add column if not exists resume_time_seconds double precision not null default 0;

alter table public.continue_watching
add column if not exists duration_seconds double precision not null default 0;

create index if not exists favorites_user_id_created_at_idx
on public.favorites (user_id, created_at desc);

create index if not exists continue_watching_user_id_last_watched_at_idx
on public.continue_watching (user_id, last_watched_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.favorites enable row level security;
alter table public.continue_watching enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select
using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles for insert
with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
using (auth.uid() = id);

drop policy if exists "favorites_select_own" on public.favorites;
create policy "favorites_select_own"
on public.favorites for select
using (auth.uid() = user_id);

drop policy if exists "favorites_insert_own" on public.favorites;
create policy "favorites_insert_own"
on public.favorites for insert
with check (auth.uid() = user_id);

drop policy if exists "favorites_delete_own" on public.favorites;
create policy "favorites_delete_own"
on public.favorites for delete
using (auth.uid() = user_id);

drop policy if exists "favorites_update_own" on public.favorites;
create policy "favorites_update_own"
on public.favorites for update
using (auth.uid() = user_id);

drop policy if exists "continue_select_own" on public.continue_watching;
create policy "continue_select_own"
on public.continue_watching for select
using (auth.uid() = user_id);

drop policy if exists "continue_insert_own" on public.continue_watching;
create policy "continue_insert_own"
on public.continue_watching for insert
with check (auth.uid() = user_id);

drop policy if exists "continue_update_own" on public.continue_watching;
create policy "continue_update_own"
on public.continue_watching for update
using (auth.uid() = user_id);

drop policy if exists "continue_delete_own" on public.continue_watching;
create policy "continue_delete_own"
on public.continue_watching for delete
using (auth.uid() = user_id);
