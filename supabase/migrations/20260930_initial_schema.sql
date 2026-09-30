-- Tables

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role text not null default 'staff',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint profiles_role_check check (role in ('admin', 'staff'))
);

create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  date date not null,
  start_time time not null,
  end_time time not null,
  location text,
  notes text,
  response_deadline timestamptz not null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.shift_requirements (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.shifts (id) on delete cascade,
  role text not null,
  staff_needed integer not null,
  constraint shift_requirements_staff_needed_check check (staff_needed > 0),
  constraint shift_requirements_shift_id_role_key unique (shift_id, role)
);

create table public.availability_responses (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.shifts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  response text not null,
  suggested_start_time time,
  suggested_end_time time,
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint availability_responses_response_check
    check (response in ('yes', 'maybe', 'no')),
  constraint availability_responses_shift_id_user_id_key
    unique (shift_id, user_id)
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.shifts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  assigned_role text not null,
  assigned_by uuid not null references public.profiles (id),
  assigned_at timestamptz default now(),
  constraint assignments_shift_id_user_id_key unique (shift_id, user_id)
);

-- Indexes

create index shifts_date_idx on public.shifts (date);
create index availability_responses_user_id_idx
  on public.availability_responses (user_id);
create index assignments_user_id_idx on public.assignments (user_id);

-- Functions and triggers

create schema if not exists private;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as profile
    where profile.id = (select auth.uid())
      and profile.role = 'admin'
  );
$$;

revoke all on function private.is_admin() from public, anon, authenticated;
grant execute on function private.is_admin() to authenticated;

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function private.set_updated_at();

create trigger shifts_set_updated_at
before update on public.shifts
for each row
execute function private.set_updated_at();

create trigger availability_responses_set_updated_at
before update on public.availability_responses
for each row
execute function private.set_updated_at();

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(
      nullif(
        pg_catalog.btrim(new.raw_user_meta_data ->> 'full_name'),
        ''
      ),
      nullif(pg_catalog.split_part(new.email, '@', 1), ''),
      'New User'
    ),
    'staff'
  );

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function private.handle_new_user();

-- Row Level Security

alter table public.profiles enable row level security;
alter table public.shifts enable row level security;
alter table public.shift_requirements enable row level security;
alter table public.availability_responses enable row level security;
alter table public.assignments enable row level security;

-- Table privileges

revoke all privileges on table
  public.profiles,
  public.shifts,
  public.shift_requirements,
  public.availability_responses,
  public.assignments
from anon, authenticated;

grant select on table
  public.profiles,
  public.shifts,
  public.shift_requirements,
  public.availability_responses,
  public.assignments
to authenticated;

grant insert, update, delete on table
  public.shifts,
  public.shift_requirements,
  public.availability_responses,
  public.assignments
to authenticated;

-- Policies: profiles

create policy profiles_select_own
on public.profiles
for select
to authenticated
using (id = (select auth.uid()));

create policy profiles_select_admin
on public.profiles
for select
to authenticated
using ((select private.is_admin()));

-- Policies: shifts

create policy shifts_select_authenticated
on public.shifts
for select
to authenticated
using (true);

create policy shifts_insert_admin
on public.shifts
for insert
to authenticated
with check ((select private.is_admin()));

create policy shifts_update_admin
on public.shifts
for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy shifts_delete_admin
on public.shifts
for delete
to authenticated
using ((select private.is_admin()));

-- Policies: shift_requirements

create policy shift_requirements_select_authenticated
on public.shift_requirements
for select
to authenticated
using (true);

create policy shift_requirements_insert_admin
on public.shift_requirements
for insert
to authenticated
with check ((select private.is_admin()));

create policy shift_requirements_update_admin
on public.shift_requirements
for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy shift_requirements_delete_admin
on public.shift_requirements
for delete
to authenticated
using ((select private.is_admin()));

-- Policies: availability_responses

create policy availability_responses_select_own
on public.availability_responses
for select
to authenticated
using (user_id = (select auth.uid()));

create policy availability_responses_select_admin
on public.availability_responses
for select
to authenticated
using ((select private.is_admin()));

create policy availability_responses_insert_own
on public.availability_responses
for insert
to authenticated
with check (user_id = (select auth.uid()));

create policy availability_responses_update_own
on public.availability_responses
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy availability_responses_delete_own
on public.availability_responses
for delete
to authenticated
using (user_id = (select auth.uid()));

-- Policies: assignments

create policy assignments_select_own
on public.assignments
for select
to authenticated
using (user_id = (select auth.uid()));

create policy assignments_select_admin
on public.assignments
for select
to authenticated
using ((select private.is_admin()));

create policy assignments_insert_admin
on public.assignments
for insert
to authenticated
with check ((select private.is_admin()));

create policy assignments_update_admin
on public.assignments
for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy assignments_delete_admin
on public.assignments
for delete
to authenticated
using ((select private.is_admin()));
