-- Organization foundation
--
-- These tables are intentionally empty and inaccessible to application roles.
-- Bootstrap data and tenant-aware access policies belong to later migrations.

-- Tables

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  timezone text not null default 'UTC',
  settings jsonb not null default '{}'::jsonb,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_name_not_blank_check
    check (pg_catalog.btrim(name) <> ''),
  constraint organizations_slug_format_check
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint organizations_timezone_not_blank_check
    check (
      timezone = pg_catalog.btrim(timezone)
      and timezone <> ''
    ),
  constraint organizations_settings_object_check
    check (pg_catalog.jsonb_typeof(settings) = 'object'),
  constraint organizations_created_by_fkey
    foreign key (created_by)
    references public.profiles (id)
    on delete restrict
);

create table public.organization_memberships (
  organization_id uuid not null,
  user_id uuid not null,
  role text not null default 'staff',
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_memberships_pkey
    primary key (organization_id, user_id),
  constraint organization_memberships_organization_id_fkey
    foreign key (organization_id)
    references public.organizations (id)
    on delete restrict,
  constraint organization_memberships_user_id_fkey
    foreign key (user_id)
    references public.profiles (id)
    on delete restrict,
  constraint organization_memberships_role_check
    check (role in ('owner', 'admin', 'manager', 'staff'))
);

-- Indexes

create index organization_memberships_user_id_idx
  on public.organization_memberships (user_id, organization_id);

create index organization_memberships_active_organization_idx
  on public.organization_memberships (organization_id, user_id)
  where disabled_at is null;

create index organization_memberships_active_role_idx
  on public.organization_memberships (organization_id, role, user_id)
  where disabled_at is null;

-- Updated-at triggers
--
-- private.set_updated_at() is defined by the initial schema migration with an
-- empty search_path and a schema-qualified call to pg_catalog.now().

create trigger organizations_set_updated_at
before update on public.organizations
for each row
execute function private.set_updated_at();

create trigger organization_memberships_set_updated_at
before update on public.organization_memberships
for each row
execute function private.set_updated_at();

-- Row Level Security
--
-- No policies or application-role grants are added in this milestone. With RLS
-- enabled, both tables remain deny-by-default until tenant policies are ready.

alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;

revoke all privileges on table
  public.organizations,
  public.organization_memberships
from public, anon, authenticated;
