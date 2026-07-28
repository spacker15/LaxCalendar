-- Run this in the Supabase SQL editor before enabling shared mode.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'viewer' check (role in ('admin','scheduler','viewer'))
);

create table if not exists public.scheduler_state (
  id text primary key default 'default',
  data jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table public.profiles enable row level security;
alter table public.scheduler_state enable row level security;

create policy "Users can read their profile" on public.profiles
for select to authenticated using (id = auth.uid());

create policy "Authenticated users can read schedule" on public.scheduler_state
for select to authenticated using (true);

create policy "Admins and schedulers can update schedule" on public.scheduler_state
for all to authenticated
using (
  exists(select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','scheduler'))
)
with check (
  exists(select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','scheduler'))
);

-- Admin-only profile management should be performed with the Supabase service role
-- or a protected server-side administration function.
