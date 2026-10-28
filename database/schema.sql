-- CampusEvents database schema.
-- Run this complete file in Supabase Dashboard -> SQL Editor.
-- The application uses a server-only service-role key and checks permissions in Express.
-- RLS is enabled as defense-in-depth; browser clients must never access these tables directly.

create extension if not exists pgcrypto;

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 100),
  email text not null unique check (char_length(email) <= 254),
  password_hash text not null,
  role text not null default 'student' check (role in ('student', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 3 and 120),
  description text not null check (char_length(trim(description)) between 5 and 2000),
  category text not null check (category in ('Technology','Workshop','Cultural','Sports','Career','Other')),
  venue text not null check (char_length(trim(venue)) between 2 and 160),
  starts_at timestamptz not null,
  capacity integer not null check (capacity between 1 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  status text not null default 'registered' check (status in ('registered','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, event_id)
);

create index if not exists events_starts_at_idx on public.events(starts_at);
create index if not exists events_category_starts_at_idx on public.events(category, starts_at);
create index if not exists registrations_event_status_idx on public.registrations(event_id, status);
create index if not exists registrations_user_created_idx on public.registrations(user_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at before update on public.events
for each row execute function public.set_updated_at();

drop trigger if exists registrations_set_updated_at on public.registrations;
create trigger registrations_set_updated_at before update on public.registrations
for each row execute function public.set_updated_at();

-- Atomic registration: prevents capacity overflow and duplicate active registrations
-- even when two students submit at nearly the same time.
create or replace function public.register_for_event(p_event_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_event public.events%rowtype;
  current_count integer;
  existing public.registrations%rowtype;
  has_existing boolean := false;
begin
  select * into target_event from public.events where id = p_event_id for update;
  if not found then raise exception 'EVENT_NOT_FOUND' using errcode = 'P0002'; end if;
  if target_event.starts_at <= now() then raise exception 'EVENT_PAST'; end if;

  select * into existing from public.registrations
    where event_id = p_event_id and user_id = p_user_id for update;
  has_existing := found;
  if has_existing and existing.status = 'registered' then raise exception 'ALREADY_REGISTERED'; end if;

  select count(*) into current_count from public.registrations
    where event_id = p_event_id and status = 'registered';
  if current_count >= target_event.capacity then raise exception 'EVENT_FULL'; end if;

  if has_existing then
    update public.registrations set status = 'registered', created_at = now()
      where id = existing.id returning * into existing;
  else
    insert into public.registrations(user_id, event_id) values (p_user_id, p_event_id)
      returning * into existing;
  end if;
  return jsonb_build_object('id', existing.id, 'event_id', existing.event_id, 'status', existing.status);
end;
$$;

-- Privileged access is intentionally performed only by the Express backend.
alter table public.app_users enable row level security;
alter table public.events enable row level security;
alter table public.registrations enable row level security;

-- No anonymous/authenticated policies are created: the browser has no database key.
-- The server's service-role key bypasses RLS, so every API operation must enforce
-- authorization in backend/middleware and backend/routes. Never expose that key.
revoke all on public.app_users from anon, authenticated;
revoke all on public.events from anon, authenticated;
revoke all on public.registrations from anon, authenticated;
revoke all on function public.register_for_event(uuid, uuid) from public, anon, authenticated;
grant execute on function public.register_for_event(uuid, uuid) to service_role;

-- Optional demonstration event; uncomment and run only if you want sample content.
-- insert into public.events(title, description, category, venue, starts_at, capacity)
-- values ('Campus Buildathon', 'A friendly day of building and sharing student projects.',
-- 'Technology', 'Innovation Lab', now() + interval '30 days', 80);
