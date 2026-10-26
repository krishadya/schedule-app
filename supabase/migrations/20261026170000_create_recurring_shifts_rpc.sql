-- Atomic recurring shift creation
--
-- This RPC is intentionally database-only in this milestone. Application code
-- does not call it yet. A PostgreSQL function call is one statement, so any
-- validation or insert error rolls back every shift and requirement it created.

create function public.create_recurring_shifts(
  p_event_name text,
  p_occurrence_dates date[],
  p_start_time time without time zone,
  p_end_time time without time zone,
  p_location text,
  p_notes text,
  p_response_deadline timestamp with time zone,
  p_requirements jsonb
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  requesting_user_id uuid := auth.uid();
  occurrence_count integer;
  distinct_occurrence_count bigint;
  occurrence_date date;
  created_shift_id uuid;
  created_count integer := 0;
begin
  -- Authorization is checked explicitly and is also enforced by the existing
  -- INSERT policies on shifts and shift_requirements.
  if requesting_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication is required to create recurring shifts.';
  end if;

  if not private.is_admin() then
    raise exception using
      errcode = '42501',
      message = 'Administrator access is required to create recurring shifts.';
  end if;

  -- Schedule validation
  if p_event_name is null or pg_catalog.btrim(p_event_name) = '' then
    raise exception using
      errcode = '22023',
      message = 'Event name is required.';
  end if;

  occurrence_count := coalesce(
    pg_catalog.cardinality(p_occurrence_dates),
    0
  );

  if occurrence_count = 0 then
    raise exception using
      errcode = '22023',
      message = 'At least one occurrence date is required.';
  end if;

  if occurrence_count > 120 then
    raise exception using
      errcode = '22023',
      message = 'A recurring schedule cannot contain more than 120 shifts.';
  end if;

  if pg_catalog.array_position(p_occurrence_dates, null::date) is not null then
    raise exception using
      errcode = '22023',
      message = 'Occurrence dates cannot contain null values.';
  end if;

  if exists (
    select 1
    from pg_catalog.unnest(p_occurrence_dates) as generated_date(value)
    where not pg_catalog.isfinite(generated_date.value)
  ) then
    raise exception using
      errcode = '22023',
      message = 'Occurrence dates must be finite calendar dates.';
  end if;

  select pg_catalog.count(distinct generated_date.value)
  into distinct_occurrence_count
  from pg_catalog.unnest(p_occurrence_dates) as generated_date(value);

  if distinct_occurrence_count <> occurrence_count then
    raise exception using
      errcode = '22023',
      message = 'Occurrence dates must be unique.';
  end if;

  if p_start_time is null or p_end_time is null then
    raise exception using
      errcode = '22023',
      message = 'Start and end times are required.';
  end if;

  if p_end_time <= p_start_time then
    raise exception using
      errcode = '22023',
      message = 'End time must be later than start time.';
  end if;

  if p_response_deadline is null
     or not pg_catalog.isfinite(p_response_deadline) then
    raise exception using
      errcode = '22023',
      message = 'A finite response deadline is required.';
  end if;

  -- Staffing requirement validation
  if p_requirements is null
     or pg_catalog.jsonb_typeof(p_requirements) <> 'array'
     or pg_catalog.jsonb_array_length(p_requirements) = 0 then
    raise exception using
      errcode = '22023',
      message = 'At least one staffing requirement is required.';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_requirements)
      as requirement(value)
    where pg_catalog.jsonb_typeof(requirement.value) is distinct from 'object'
       or pg_catalog.jsonb_typeof(requirement.value -> 'role')
         is distinct from 'string'
       or pg_catalog.btrim(requirement.value ->> 'role') = ''
       or pg_catalog.jsonb_typeof(requirement.value -> 'staff_needed')
         is distinct from 'number'
  ) then
    raise exception using
      errcode = '22023',
      message = 'Each staffing requirement needs a role and staff count.';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_requirements)
      as requirement(value)
    where (requirement.value ->> 'staff_needed')::numeric < 1
       or (requirement.value ->> 'staff_needed')::numeric
         <> pg_catalog.trunc(
           (requirement.value ->> 'staff_needed')::numeric
         )
       or (requirement.value ->> 'staff_needed')::numeric > 2147483647
  ) then
    raise exception using
      errcode = '22023',
      message = 'Staff needed must be a positive integer.';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_requirements)
      as requirement(value)
    group by pg_catalog.lower(
      pg_catalog.btrim(requirement.value ->> 'role')
    )
    having pg_catalog.count(*) > 1
  ) then
    raise exception using
      errcode = '22023',
      message = 'Staffing requirement roles must be unique.';
  end if;

  -- Inserts remain inside this function call's transaction. There is no
  -- exception handler or manual cleanup that could permit a partial result.
  for occurrence_date in
    select generated_date.value
    from pg_catalog.unnest(p_occurrence_dates) as generated_date(value)
    order by generated_date.value
  loop
    insert into public.shifts (
      event_name,
      date,
      start_time,
      end_time,
      location,
      notes,
      response_deadline,
      created_by
    )
    values (
      pg_catalog.btrim(p_event_name),
      occurrence_date,
      p_start_time,
      p_end_time,
      nullif(pg_catalog.btrim(p_location), ''),
      nullif(pg_catalog.btrim(p_notes), ''),
      p_response_deadline,
      requesting_user_id
    )
    returning id into created_shift_id;

    insert into public.shift_requirements (
      shift_id,
      role,
      staff_needed
    )
    select
      created_shift_id,
      pg_catalog.btrim(requirement.value ->> 'role'),
      (requirement.value ->> 'staff_needed')::integer
    from pg_catalog.jsonb_array_elements(p_requirements)
      as requirement(value);

    created_count := created_count + 1;
  end loop;

  return created_count;
end;
$$;

comment on function public.create_recurring_shifts(
  text,
  date[],
  time without time zone,
  time without time zone,
  text,
  text,
  timestamp with time zone,
  jsonb
) is
  'Atomically creates up to 120 recurring shifts and their requirements for the authenticated admin.';

revoke all on function public.create_recurring_shifts(
  text,
  date[],
  time without time zone,
  time without time zone,
  text,
  text,
  timestamp with time zone,
  jsonb
) from public, anon;

grant execute on function public.create_recurring_shifts(
  text,
  date[],
  time without time zone,
  time without time zone,
  text,
  text,
  timestamp with time zone,
  jsonb
) to authenticated;
