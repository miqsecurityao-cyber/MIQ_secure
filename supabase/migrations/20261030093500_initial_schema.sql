begin;

create table public.miq_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.miq_admins enable row level security;

create or replace function public.is_miq_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.miq_admins
    where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_miq_admin() from public;
grant execute on function public.is_miq_admin() to authenticated;

grant select on public.miq_admins to authenticated;

create policy "Admins can view their own access record"
  on public.miq_admins
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create table public.clients (
  id text primary key,
  name text not null,
  email text not null default '',
  phone text not null default '',
  created_at text not null
);

create table public.requests (
  id text primary key,
  client text not null,
  service text not null,
  status text not null,
  created_at text not null,
  diagnostic_date text,
  installation_date text
);

create table public.quotes (
  id text primary key,
  client text not null,
  client_id text,
  request_id text,
  service text not null,
  amount numeric not null check (amount >= 0),
  status text not null,
  created_at text not null,
  installation_date text,
  items jsonb not null default '[]'::jsonb
    check (jsonb_typeof(items) = 'array')
);

alter table public.clients enable row level security;
alter table public.requests enable row level security;
alter table public.quotes enable row level security;

grant select, insert, update, delete
  on public.clients, public.requests, public.quotes
  to authenticated;

create policy "Only MIQ admins can access clients"
  on public.clients
  for all
  to authenticated
  using ((select public.is_miq_admin()))
  with check ((select public.is_miq_admin()));

create policy "Only MIQ admins can access requests"
  on public.requests
  for all
  to authenticated
  using ((select public.is_miq_admin()))
  with check ((select public.is_miq_admin()));

create policy "Only MIQ admins can access quotes"
  on public.quotes
  for all
  to authenticated
  using ((select public.is_miq_admin()))
  with check ((select public.is_miq_admin()));

commit;
