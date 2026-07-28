-- Run this entire file in the Supabase SQL editor.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'viewer' check (role in ('admin','scheduler','viewer')),
  created_at timestamptz not null default now()
);

create table if not exists public.scheduler_state (
  id text primary key default 'default',
  data jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table public.profiles enable row level security;
alter table public.scheduler_state enable row level security;

grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.scheduler_state to authenticated;
grant all on public.profiles, public.scheduler_state to service_role;

drop policy if exists "Users can read their profile" on public.profiles;
create policy "Users can read their profile" on public.profiles
for select to authenticated
using ((select auth.uid()) = id);

drop policy if exists "Authenticated users can read schedule" on public.scheduler_state;
create policy "Authenticated users can read schedule" on public.scheduler_state
for select to authenticated
using (true);

drop policy if exists "Admins and schedulers can insert schedule" on public.scheduler_state;
create policy "Admins and schedulers can insert schedule" on public.scheduler_state
for insert to authenticated
with check (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role in ('admin', 'scheduler')
  )
);

drop policy if exists "Admins and schedulers can update schedule" on public.scheduler_state;
create policy "Admins and schedulers can update schedule" on public.scheduler_state
for update to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role in ('admin', 'scheduler')
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role in ('admin', 'scheduler')
  )
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, role)
  values (new.id, 'viewer')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Existing users who signed up before the trigger was installed.
insert into public.profiles (id, role)
select id, 'viewer' from auth.users
on conflict (id) do nothing;

-- Add the shared state table to Supabase Realtime once.
do $$
begin
  alter publication supabase_realtime add table public.scheduler_state;
exception
  when duplicate_object then null;
end $$;

-- After your first sign-in, promote yourself to administrator in the SQL editor:
-- update public.profiles set role = 'admin' where id = '<YOUR AUTH USER UUID>';
