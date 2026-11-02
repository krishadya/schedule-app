-- Shift replacement requests
--
-- A staff member who is assigned to a shift can ask to be replaced. An admin
-- approves (which removes the assignment, opening the slot) or declines.
-- Requests are kept as history; nothing is deleted except by shift deletion.

create table public.replacement_requests (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.shifts (id) on delete cascade,
  requested_by uuid not null references public.profiles (id) on delete cascade,
  reason text,
  status text not null default 'pending',
  admin_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id) on delete set null,
  constraint replacement_requests_status_check
    check (status in ('pending', 'approved', 'declined', 'cancelled')),
  constraint replacement_requests_reason_length_check
    check (reason is null or pg_catalog.char_length(reason) <= 500),
  constraint replacement_requests_admin_note_length_check
    check (admin_note is null or pg_catalog.char_length(admin_note) <= 500),
  constraint replacement_requests_resolution_check
    check ((status = 'pending') = (resolved_at is null))
);

-- Only one open request per person per shift.
create unique index replacement_requests_one_pending_idx
  on public.replacement_requests (shift_id, requested_by)
  where status = 'pending';

create index replacement_requests_requested_by_idx
  on public.replacement_requests (requested_by);

create index replacement_requests_status_idx
  on public.replacement_requests (status);

-- Row Level Security

alter table public.replacement_requests enable row level security;

revoke all privileges on table public.replacement_requests
from anon, authenticated;

grant select on table public.replacement_requests to authenticated;
grant insert (shift_id, requested_by, reason)
  on table public.replacement_requests to authenticated;
grant update (status, admin_note, resolved_at, resolved_by)
  on table public.replacement_requests to authenticated;

create policy replacement_requests_select_own
on public.replacement_requests
for select
to authenticated
using (requested_by = (select auth.uid()));

create policy replacement_requests_select_admin
on public.replacement_requests
for select
to authenticated
using ((select private.is_admin()));

-- Staff may only request replacement for a shift they are assigned to.
create policy replacement_requests_insert_own
on public.replacement_requests
for insert
to authenticated
with check (
  requested_by = (select auth.uid())
  and status = 'pending'
  and exists (
    select 1
    from public.assignments as assignment
    where assignment.shift_id = replacement_requests.shift_id
      and assignment.user_id = (select auth.uid())
  )
);

-- Staff may only cancel their own pending request.
create policy replacement_requests_cancel_own
on public.replacement_requests
for update
to authenticated
using (
  requested_by = (select auth.uid())
  and status = 'pending'
)
with check (
  requested_by = (select auth.uid())
  and status = 'cancelled'
  and admin_note is null
  and resolved_by is null
);

create policy replacement_requests_update_admin
on public.replacement_requests
for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

-- Approve or decline a request in one atomic step. Approving also removes
-- the requester's assignment so the slot can be filled by someone else.
-- SECURITY INVOKER: the existing admin RLS policies still apply.

create function public.resolve_replacement_request(
  p_request_id uuid,
  p_approve boolean,
  p_admin_note text
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  requesting_user_id uuid := auth.uid();
  request record;
  new_status text;
begin
  if requesting_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication is required.';
  end if;

  if not private.is_admin() then
    raise exception using
      errcode = '42501',
      message = 'Administrator access is required to resolve requests.';
  end if;

  if p_approve is null then
    raise exception using
      errcode = '22023',
      message = 'Choose approve or decline.';
  end if;

  select replacement_request.id,
         replacement_request.shift_id,
         replacement_request.requested_by,
         replacement_request.status
  into request
  from public.replacement_requests as replacement_request
  where replacement_request.id = p_request_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'The replacement request was not found.';
  end if;

  if request.status <> 'pending' then
    raise exception using
      errcode = '22023',
      message = 'This replacement request has already been resolved.';
  end if;

  new_status := case when p_approve then 'approved' else 'declined' end;

  update public.replacement_requests
  set status = new_status,
      admin_note = nullif(pg_catalog.btrim(coalesce(p_admin_note, '')), ''),
      resolved_at = pg_catalog.now(),
      resolved_by = requesting_user_id
  where id = request.id;

  if p_approve then
    delete from public.assignments
    where shift_id = request.shift_id
      and user_id = request.requested_by;
  end if;

  return new_status;
end;
$$;

revoke all on function public.resolve_replacement_request(uuid, boolean, text)
from public, anon;

grant execute on function public.resolve_replacement_request(uuid, boolean, text)
to authenticated;
