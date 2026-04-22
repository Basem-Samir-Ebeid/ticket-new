-- Leave requests feature
-- Run this in the Supabase SQL Editor

create extension if not exists "uuid-ossp";

create table if not exists public.leave_requests (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  reason text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_note text,
  decided_by uuid references auth.users(id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create index if not exists leave_requests_user_id_idx on public.leave_requests(user_id);
create index if not exists leave_requests_status_idx on public.leave_requests(status);

alter table public.leave_requests enable row level security;

drop policy if exists "User reads leave_requests" on public.leave_requests;
create policy "User reads leave_requests" on public.leave_requests
  for select using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

drop policy if exists "User inserts own leave_requests" on public.leave_requests;
create policy "User inserts own leave_requests" on public.leave_requests
  for insert with check (
    user_id = auth.uid()
    and status = 'pending'
    and admin_note is null
    and decided_by is null
    and decided_at is null
  );

drop policy if exists "Admin updates leave_requests" on public.leave_requests;
create policy "Admin updates leave_requests" on public.leave_requests
  for update using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  ) with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

drop policy if exists "Admin deletes leave_requests" on public.leave_requests;
create policy "Admin deletes leave_requests" on public.leave_requests
  for delete using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Enable realtime updates so the user sees admin decisions immediately
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'leave_requests'
  ) then
    alter publication supabase_realtime add table public.leave_requests;
  end if;
end
$$;
