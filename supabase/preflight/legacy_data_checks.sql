-- Schedule App legacy data preflight
--
-- Run this script manually in the Supabase SQL Editor before the first
-- multi-tenant migration. Every executable statement is a read-only SELECT.
-- Auth output is limited to UUIDs and timestamps; no credentials are selected.

-- 01. Inventory totals

select
  'profiles' as object_name,
  pg_catalog.count(*) as row_count
from public.profiles
union all
select
  'auth_users',
  pg_catalog.count(*)
from auth.users
union all
select
  'shifts',
  pg_catalog.count(*)
from public.shifts
union all
select
  'shift_requirements',
  pg_catalog.count(*)
from public.shift_requirements
union all
select
  'availability_responses',
  pg_catalog.count(*)
from public.availability_responses
union all
select
  'assignments',
  pg_catalog.count(*)
from public.assignments
order by object_name;

-- 02. Profile counts by role

select
  pg_catalog.count(*) as total_profiles,
  pg_catalog.count(*) filter (
    where profile.role = 'admin'
  ) as admin_profiles,
  pg_catalog.count(*) filter (
    where profile.role = 'staff'
  ) as staff_profiles,
  pg_catalog.count(*) filter (
    where profile.role is null
       or profile.role not in ('admin', 'staff')
  ) as unexpected_role_profiles
from public.profiles as profile;

-- 03. Auth users without profiles

select
  'auth_users_without_profiles' as check_name,
  pg_catalog.count(*) as issue_count
from auth.users as auth_user
left join public.profiles as profile on profile.id = auth_user.id
where profile.id is null;

select
  auth_user.id as auth_user_id,
  auth_user.created_at as auth_user_created_at
from auth.users as auth_user
left join public.profiles as profile on profile.id = auth_user.id
where profile.id is null
order by auth_user.created_at, auth_user.id;

-- 04. Profiles without valid Auth users

select
  'profiles_without_auth_users' as check_name,
  pg_catalog.count(*) as issue_count
from public.profiles as profile
left join auth.users as auth_user on auth_user.id = profile.id
where auth_user.id is null;

select
  profile.id as profile_id,
  profile.full_name,
  profile.username,
  profile.role,
  profile.created_at as profile_created_at
from public.profiles as profile
left join auth.users as auth_user on auth_user.id = profile.id
where auth_user.id is null
order by profile.created_at, profile.id;

-- 05. Unexpected profile roles

select
  profile.id as profile_id,
  profile.full_name,
  profile.username,
  profile.role
from public.profiles as profile
where profile.role is null
   or profile.role not in ('admin', 'staff')
order by profile.username, profile.id;

-- 06. Duplicate usernames after normalization

select
  pg_catalog.lower(pg_catalog.btrim(profile.username)) as normalized_username,
  pg_catalog.count(*) as profile_count,
  pg_catalog.string_agg(
    profile.id::text,
    ', '
    order by profile.id::text
  ) as profile_ids
from public.profiles as profile
group by pg_catalog.lower(pg_catalog.btrim(profile.username))
having pg_catalog.count(*) > 1
order by normalized_username;

-- 07. Invalid usernames
-- The 50-character limit matches the current application validation.

select
  profile.id as profile_id,
  profile.full_name,
  profile.username,
  profile.username is null as is_null,
  profile.username = '' as is_empty,
  profile.username is distinct from pg_catalog.lower(profile.username)
    as is_not_lowercase,
  profile.username is distinct from pg_catalog.btrim(profile.username)
    as has_outer_whitespace,
  profile.username is not null
    and profile.username !~ '^[a-z0-9._-]+$'
    as has_invalid_characters,
  profile.username is not null
    and pg_catalog.char_length(profile.username) > 50
    as exceeds_application_limit
from public.profiles as profile
where profile.username is null
   or profile.username = ''
   or profile.username is distinct from pg_catalog.lower(profile.username)
   or profile.username is distinct from pg_catalog.btrim(profile.username)
   or profile.username !~ '^[a-z0-9._-]+$'
   or pg_catalog.char_length(profile.username) > 50
order by profile.username nulls first, profile.id;

-- 08. Relationship and constraint anomaly summary

select
  'shifts_without_creators' as check_name,
  (
    select pg_catalog.count(*)
    from public.shifts as shift
    left join public.profiles as creator on creator.id = shift.created_by
    where creator.id is null
  ) as issue_count
union all
select
  'requirements_without_shifts',
  (
    select pg_catalog.count(*)
    from public.shift_requirements as requirement
    left join public.shifts as shift on shift.id = requirement.shift_id
    where shift.id is null
  )
union all
select
  'responses_without_shifts',
  (
    select pg_catalog.count(*)
    from public.availability_responses as response
    left join public.shifts as shift on shift.id = response.shift_id
    where shift.id is null
  )
union all
select
  'responses_without_profiles',
  (
    select pg_catalog.count(*)
    from public.availability_responses as response
    left join public.profiles as profile on profile.id = response.user_id
    where profile.id is null
  )
union all
select
  'assignments_without_shifts',
  (
    select pg_catalog.count(*)
    from public.assignments as assignment
    left join public.shifts as shift on shift.id = assignment.shift_id
    where shift.id is null
  )
union all
select
  'assignments_without_profiles',
  (
    select pg_catalog.count(*)
    from public.assignments as assignment
    left join public.profiles as profile on profile.id = assignment.user_id
    where profile.id is null
  )
union all
select
  'assignments_without_assigners',
  (
    select pg_catalog.count(*)
    from public.assignments as assignment
    left join public.profiles as assigner on assigner.id = assignment.assigned_by
    where assigner.id is null
  )
union all
select
  'assignments_to_non_staff_profiles',
  (
    select pg_catalog.count(*)
    from public.assignments as assignment
    join public.profiles as profile on profile.id = assignment.user_id
    where profile.role <> 'staff'
  )
union all
select
  'shifts_without_requirements',
  (
    select pg_catalog.count(*)
    from public.shifts as shift
    left join public.shift_requirements as requirement
      on requirement.shift_id = shift.id
    where requirement.id is null
  )
union all
select
  'invalid_requirement_counts',
  (
    select pg_catalog.count(*)
    from public.shift_requirements as requirement
    where requirement.staff_needed < 1
  )
order by check_name;

-- 09. Assignments whose role does not match a requirement on the same shift

select
  assignment.id as assignment_id,
  assignment.shift_id,
  shift.event_name,
  assignment.user_id,
  assignment.assigned_role
from public.assignments as assignment
join public.shifts as shift on shift.id = assignment.shift_id
left join public.shift_requirements as requirement
  on requirement.shift_id = assignment.shift_id
 and requirement.role = assignment.assigned_role
where requirement.id is null
order by shift.date, shift.start_time, assignment.shift_id, assignment.id;

-- 10. Roles whose assignment count exceeds staffing capacity

select
  requirement.shift_id,
  shift.event_name,
  shift.date,
  requirement.role,
  requirement.staff_needed,
  pg_catalog.count(assignment.id) as assignment_count,
  pg_catalog.count(assignment.id) - requirement.staff_needed as excess_count
from public.shift_requirements as requirement
join public.shifts as shift on shift.id = requirement.shift_id
left join public.assignments as assignment
  on assignment.shift_id = requirement.shift_id
 and assignment.assigned_role = requirement.role
group by
  requirement.shift_id,
  shift.event_name,
  shift.date,
  requirement.role,
  requirement.staff_needed
having pg_catalog.count(assignment.id) > requirement.staff_needed
order by shift.date, requirement.shift_id, requirement.role;

-- 11. Invalid same-day shift times

select
  shift.id as shift_id,
  shift.event_name,
  shift.date,
  shift.start_time,
  shift.end_time
from public.shifts as shift
where shift.end_time <= shift.start_time
order by shift.date, shift.start_time, shift.id;

-- 12. Legacy owner readiness summary
-- This reports readiness only. It does not select or recommend an owner.

select
  pg_catalog.count(*) filter (
    where profile.role = 'admin'
  ) as existing_admin_count,
  pg_catalog.count(*) filter (
    where profile.role = 'admin'
      and auth_user.id is not null
      and profile.username is not null
      and profile.username = pg_catalog.lower(profile.username)
      and profile.username = pg_catalog.btrim(profile.username)
      and profile.username ~ '^[a-z0-9._-]+$'
      and pg_catalog.char_length(profile.username) <= 50
  ) as eligible_admin_count,
  case
    when pg_catalog.count(*) filter (
      where profile.role = 'admin'
        and auth_user.id is not null
        and profile.username is not null
        and profile.username = pg_catalog.lower(profile.username)
        and profile.username = pg_catalog.btrim(profile.username)
        and profile.username ~ '^[a-z0-9._-]+$'
        and pg_catalog.char_length(profile.username) <= 50
    ) = 0
      then 'BLOCKED: no eligible existing admin'
    else 'READY FOR MANUAL OWNER SELECTION'
  end as owner_selection_status
from public.profiles as profile
left join auth.users as auth_user on auth_user.id = profile.id;

-- 13. Eligible legacy-owner candidates
-- Review every row and choose explicitly outside this script.

select
  profile.id as profile_id,
  profile.full_name,
  profile.username,
  profile.created_at as profile_created_at,
  auth_user.created_at as auth_user_created_at,
  (
    select pg_catalog.count(*)
    from public.shifts as shift
    where shift.created_by = profile.id
  ) as shifts_created,
  (
    select pg_catalog.count(*)
    from public.assignments as assignment
    where assignment.assigned_by = profile.id
  ) as assignments_made
from public.profiles as profile
join auth.users as auth_user on auth_user.id = profile.id
where profile.role = 'admin'
  and profile.username is not null
  and profile.username = pg_catalog.lower(profile.username)
  and profile.username = pg_catalog.btrim(profile.username)
  and profile.username ~ '^[a-z0-9._-]+$'
  and pg_catalog.char_length(profile.username) <= 50
order by profile.username, profile.id;

-- 14. RLS status for application tables and avatar objects

select
  namespace.nspname as schema_name,
  relation.relname as table_name,
  relation.relrowsecurity as rls_enabled,
  relation.relforcerowsecurity as rls_forced,
  (
    select pg_catalog.count(*)
    from pg_catalog.pg_policy as policy
    where policy.polrelid = relation.oid
  ) as policy_count
from pg_catalog.pg_class as relation
join pg_catalog.pg_namespace as namespace
  on namespace.oid = relation.relnamespace
where relation.relkind in ('r', 'p')
  and (
    (
      namespace.nspname = 'public'
      and relation.relname in (
        'profiles',
        'shifts',
        'shift_requirements',
        'availability_responses',
        'assignments'
      )
    )
    or (
      namespace.nspname = 'storage'
      and relation.relname = 'objects'
    )
  )
order by namespace.nspname, relation.relname;

-- 15. Existing RLS policy names and definitions

select
  policy.schemaname as schema_name,
  policy.tablename as table_name,
  policy.policyname as policy_name,
  policy.permissive,
  policy.roles,
  policy.cmd,
  policy.qual,
  policy.with_check
from pg_catalog.pg_policies as policy
where (
    policy.schemaname = 'public'
    and policy.tablename in (
      'profiles',
      'shifts',
      'shift_requirements',
      'availability_responses',
      'assignments'
    )
  )
  or (
    policy.schemaname = 'storage'
    and policy.tablename = 'objects'
    and policy.policyname like 'avatar_objects_%'
  )
order by policy.schemaname, policy.tablename, policy.policyname;
