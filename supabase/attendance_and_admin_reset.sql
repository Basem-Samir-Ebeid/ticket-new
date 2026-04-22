-- Attendance upgrades for sign-off support
alter table if exists public.login_times
  add column if not exists logout_time timestamptz,
  add column if not exists logout_latitude double precision,
  add column if not exists logout_longitude double precision;

alter table if exists public.profiles
  add column if not exists can_view_attendance boolean not null default false;

create table if not exists public.session_revocations (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid not null,
  reason text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role, can_view_attendance)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    coalesce(new.raw_user_meta_data->>'role', 'employee'),
    coalesce((new.raw_user_meta_data->>'can_view_attendance')::boolean, false)
  );
  return new;
end;
$$ language plpgsql security definer;

alter table if exists public.login_times enable row level security;
alter table if exists public.session_revocations enable row level security;

drop policy if exists "Admin insert session_revocations" on public.session_revocations;
create policy "Admin insert session_revocations" on public.session_revocations
  for insert with check (
    exists (
      select 1
      from public.profiles as profile_row
      where profile_row.id = auth.uid() and profile_row.role = 'admin'
    )
  );

drop policy if exists "Users see own session_revocations" on public.session_revocations;
create policy "Users see own session_revocations" on public.session_revocations
  for select using (user_id = auth.uid());

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'session_revocations'
  ) then
    alter publication supabase_realtime add table public.session_revocations;
  end if;
end
$$;

drop policy if exists "Admin full access login_times" on public.login_times;
create policy "Admin full access login_times" on public.login_times
  for all using (
    exists (
      select 1
      from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

drop policy if exists "Users see own login_times" on public.login_times;
create policy "Users see own login_times" on public.login_times
  for select using (user_id = auth.uid());

drop function if exists public.get_attendance_records(date);
drop function if exists public.get_attendance_records(text);

create function public.get_attendance_records(target_date text)
returns table (
  id uuid,
  user_id uuid,
  date text,
  login_time timestamptz,
  logout_time timestamptz,
  latitude double precision,
  longitude double precision,
  logout_latitude double precision,
  logout_longitude double precision,
  full_name text,
  email text,
  role text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.profiles as profile_row
    where profile_row.id = auth.uid()
      and (profile_row.role = 'admin' or profile_row.can_view_attendance = true)
  ) then
    raise exception 'Not allowed to view attendance';
  end if;

  return query
  select
    lt.id,
    lt.user_id,
    lt.date::text,
    lt.login_time,
    lt.logout_time,
    lt.latitude::double precision,
    lt.longitude::double precision,
    lt.logout_latitude::double precision,
    lt.logout_longitude::double precision,
    p.full_name,
    p.email,
    p.role
  from public.login_times lt
  join public.profiles p on p.id = lt.user_id
  where lt.date::text = target_date
  order by lt.login_time desc;
end;
$$;

grant execute on function public.get_attendance_records(text) to authenticated;

drop view if exists public.login_times_with_profiles;

create view public.login_times_with_profiles as
select
  lt.id,
  lt.user_id,
  lt.date,
  lt.login_time,
  lt.logout_time,
  lt.latitude,
  lt.longitude,
  lt.logout_latitude,
  lt.logout_longitude,
  p.full_name,
  p.email,
  p.role
from public.login_times lt
join public.profiles p on p.id = lt.user_id;

grant select on public.login_times_with_profiles to authenticated;
