# Legacy tenant data preflight

This preflight is a read-only inspection of the existing single-organization database before any multi-tenant migration. It does not create an organization, choose an owner, change RLS, or repair data.

The SQL is located at [`legacy_data_checks.sql`](./legacy_data_checks.sql).

## Before running it

1. Confirm the SQL Editor is connected to the intended Supabase project and environment.
2. Prefer running it in a staging clone first.
3. Open the SQL file and verify that every executable statement is a `SELECT`.
4. Do not add a data-changing statement to the preflight file.
5. Treat the results as internal data. The script does not select emails, passwords, tokens, secrets, Auth metadata, or credential material, but some result sets contain profile names, usernames, and UUIDs.

The queries read `auth.users` and PostgreSQL system catalogs. Run them through the Supabase Dashboard SQL Editor as a project administrator; they are not intended to run from the application or through the anonymous API.

## How to run it

1. In the Supabase Dashboard, open **SQL Editor**.
2. Select **New query**.
3. Copy the complete contents of `docs/archive/legacy_data_checks.sql` into the editor.
4. Run the query without changing it.
5. Review and save each labeled result set internally. Supabase displays the results of the statements separately.
6. Record the date, environment, and reviewer. Do not publish or attach the raw results to a public issue.
7. Resolve blockers, rerun the complete script, and retain the clean results as the baseline for the later backfill.

This repository does not automatically run the file against a remote database.

## Successful results

### Inventory and profile roles

- Inventory counts are non-negative and agree with expected production usage.
- `admin_profiles` is at least one.
- `unexpected_role_profiles` is zero.
- `admin_profiles + staff_profiles` equals `total_profiles`.
- The shift, requirement, response, and assignment counts become the row-count baseline for later backfill verification.

An empty installation needs a separate bootstrap plan because it cannot supply an existing legacy owner. It should not use the normal legacy-data seed blindly.

### Auth/profile integrity

Both issue counts must be zero:

- `auth_users_without_profiles`
- `profiles_without_auth_users`

Their following detail result sets should be empty. UUIDs and creation timestamps are included only to support internal investigation; Auth email and metadata are intentionally excluded.

### Usernames

Both username result sets should be empty:

- Duplicate usernames after trimming and lowercase normalization
- Invalid usernames

The preflight checks the database character rules and the application's current 50-character maximum. This is stricter than merely trusting the existing exact-value unique constraint and catches values that would normalize to the same login handle.

### Scheduling relationships

Every count in the relationship anomaly summary should be zero. In particular:

- Every shift has a valid creator.
- Every requirement, response, and assignment has a valid shift.
- Every response and assignment user has a profile.
- Every assignment has a valid assigner.
- Assigned users currently have the `staff` role.
- Every shift has at least one requirement.
- Every requirement has a positive staffing count.

The assignment-role mismatch, over-capacity, and invalid-time detail result sets should also be empty.

### Legacy owner readiness

The readiness summary should say:

```text
READY FOR MANUAL OWNER SELECTION
```

`eligible_admin_count` must be at least one. The candidate result set lists all eligible existing admins and some scheduling activity for context. It deliberately has no automatic selection, ranking, or promotion. An authorized project owner must explicitly identify the initial organization owner in a later milestone.

Multiple eligible admins are not an error. Select one deliberately; the remaining legacy admins can initially become organization admins as described in the architecture plan.

### RLS inventory

For the five application tables, `rls_enabled` should be true and `rls_forced` should be false, matching the current migrations. `storage.objects` should also report RLS enabled in a normal Supabase project.

The expected current application policy names are:

- Profiles: `profiles_select_own`, `profiles_select_admin`, `profiles_update_own_details`
- Shifts: `shifts_select_authenticated`, `shifts_insert_admin`, `shifts_update_admin`, `shifts_delete_admin`
- Shift requirements: `shift_requirements_select_authenticated`, `shift_requirements_insert_admin`, `shift_requirements_update_admin`, `shift_requirements_delete_admin`
- Availability responses: `availability_responses_select_own`, `availability_responses_select_admin`, `availability_responses_insert_own`, `availability_responses_update_own`, `availability_responses_delete_own`
- Assignments: `assignments_select_own`, `assignments_select_admin`, `assignments_insert_admin`, `assignments_update_admin`, `assignments_delete_admin`
- Avatar objects: `avatar_objects_select_own`, `avatar_objects_insert_own`, `avatar_objects_update_own`, `avatar_objects_delete_own`

Unexpected extra or missing policies require investigation. Do not repair policy drift manually during this preflight. Any correction should be a separately reviewed migration.

## Migration blockers

Do not proceed to legacy organization seeding or tenant-key constraints while any of these conditions exist:

- No eligible existing admin is available for explicit owner selection.
- An Auth user lacks a profile or a profile lacks a valid Auth user.
- A profile has an unexpected role.
- A username is invalid or duplicates another username after normalization.
- A tenant-owned row has a missing related shift or profile.
- An assignment points to a missing requirement role.
- Assignment counts exceed a requirement's capacity.
- A shift ends at or before its start time under the current same-day model.
- A shift has no requirement or a requirement has a non-positive count.
- Current RLS state does not match the reviewed migration history.

Inventory counts alone are not blockers. They are baselines used to prove that later backfills neither lose nor duplicate records.

## Fixing issues before proceeding

Use the existing application workflows where they safely support the repair:

- Correct invalid shift times through Edit Shift.
- Remove or reassign invalid assignments through the shift administration page.
- Increase a requirement count or remove assignments to resolve over-capacity roles.
- Add a requirement to any shift that lacks one.
- Use the current account/profile workflow for valid username corrections when possible.

Identity, orphaned-row, or RLS anomalies should not be fixed ad hoc in the SQL Editor. Investigate their cause, take a backup, and prepare a focused, reviewed repair migration or administrative procedure. Rerun the whole preflight afterward.

If no eligible admin exists, explicitly create or repair an admin through an approved current process, verify that the Auth user and profile match, and rerun the preflight. This script must never promote a user or choose the owner.

## Risks to carry into the migration

- Existing foreign keys make many orphan conditions unlikely, but the preflight must verify production state rather than assume every migration was applied identically.
- The current role uniqueness on shift requirements is case-sensitive, while application duplicate validation is case-insensitive. A later database constraint should normalize role keys.
- Current assignment capacity is checked across multiple requests rather than one database transaction. Clean preflight results do not remove the future concurrency risk.
- The current global RLS policies are intentionally recorded, not changed. They remain unsuitable for multiple organizations and must be replaced only during the coordinated RLS cutover.
- The service-role Auth Admin client bypasses RLS. Clean data does not replace the later need for explicit organization authorization at every privileged call site.
- The current timezone is hardcoded to `America/Los_Angeles`. Existing date/time values must be interpreted using that legacy timezone during backfill.
- Avatars are stored in a public bucket. The preflight does not evaluate object privacy or enumerate avatar contents.

## Sign-off record

Before the next migration milestone, record internally:

- Environment and project reference
- Preflight execution timestamp
- Reviewer
- Inventory counts
- Confirmation that all blocking result sets are empty
- The explicitly approved legacy-owner profile ID
- Backup or restore-point reference

Owner approval belongs in the deployment record, not in this read-only SQL file.
