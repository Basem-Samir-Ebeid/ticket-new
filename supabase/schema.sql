-- Run this in Supabase SQL Editor

create extension if not exists "uuid-ossp";

create table profiles (
  id uuid references auth.users on delete cascade primary key,
  email text unique not null,
  full_name text,
  role text check (role in ('admin', 'employee')) default 'employee',
  can_view_attendance boolean not null default false,
  created_at timestamptz default now()
);

create table tickets (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  description text,
  assigned_to uuid references profiles(id),
  created_by uuid references profiles(id),
  status text check (status in ('opened', 'pending', 'solved')) default 'opened',
  created_at timestamptz default now()
);

alter table profiles enable row level security;
alter table tickets enable row level security;

-- Profiles policies (use auth.jwt() to avoid RLS recursion)
create policy "Admin full access profiles" on profiles
  for all using (
    (auth.jwt() ->> 'role') = 'admin'
    or (select role from profiles where id = auth.uid()) = 'admin'
  );
create policy "Employee sees own profile" on profiles
  for select using (id = auth.uid());

-- Allow trigger to insert profile on signup (bypasses RLS)
create policy "Service role insert profiles" on profiles
  for insert with check (true);

-- Tickets policies
create policy "Admin full access tickets" on tickets
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
create policy "Employee sees own tickets" on tickets
  for select using (assigned_to = auth.uid() or created_by = auth.uid());
create policy "Employee creates tickets" on tickets
  for insert with check (created_by = auth.uid());

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, email, full_name, role, can_view_attendance)
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
