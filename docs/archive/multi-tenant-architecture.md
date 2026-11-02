# Multi-tenant architecture audit and migration plan

Status: planning only. This document does not authorize or contain an executable database migration.

## Executive summary

Schedule App is currently a sound single-organization application, but organization identity is implicit. Authorization is based on the global `profiles.role` column, authenticated users can read every shift, and tenant-owned rows have no organization key. Those assumptions mean a second organization cannot be added safely by UI filtering alone.

The target design should keep one global Supabase Auth user and one global `profiles` row per person, then attach that person to one or more organizations through `organization_memberships`. Authorization must come from the membership for the organization being accessed, not from `profiles.role`. Every scheduling row should carry an `organization_id`, and composite foreign keys should make cross-organization relationships impossible even when application code is wrong.

The migration must be additive first. Create a single legacy organization, place every existing profile and record into it, introduce tenant-aware application reads and writes, and only then replace the current global RLS policies in one coordinated security cutover. Existing Auth user IDs, passwords, usernames, profile IDs, record IDs, and avatar paths can remain unchanged.

## Current architecture audit

### Identity and authentication

- `auth.users.id` and `public.profiles.id` are a one-to-one global identity.
- `private.handle_new_user()` creates one global profile and defaults `profiles.role` to `staff`.
- Usernames are globally unique, lowercase, and limited to `[a-z0-9._-]`.
- Login converts a username to `username@<domain>.local` and calls Supabase password authentication.
- A username change first updates `profiles`, then uses the service-role Auth Admin API to change the synthetic email. The two systems are compensated on error but are not one transaction.
- `getAuthenticatedProfile()` returns a global `admin` or `staff` role. Pages and Server Actions use that value as their authorization decision.
- There is no active-organization context, organization selector, organization identifier in a route, or membership lookup.

### Current data ownership and RLS

| Object | Current ownership assumption | Current effective access |
| --- | --- | --- |
| `profiles` | One global staff directory | A user reads self; a global admin reads all profiles; users update selected fields on self |
| `shifts` | Every shift belongs to the one application | Every authenticated user reads all; global admins write all |
| `shift_requirements` | Ownership is inherited informally from `shift_id` | Every authenticated user reads all; global admins write all |
| `availability_responses` | A response is private to a user except for the global admin | User manages own responses; global admin reads all |
| `assignments` | An assignment is private to a user except for the global admin | User reads own; global admin reads and writes all |
| `storage.objects` in `avatars` | Avatar belongs to the Auth user whose UUID is the first path segment | The user can write/delete only their path; the bucket itself is public |

`private.is_admin()` is a `SECURITY DEFINER` helper with a safe empty `search_path`, but it checks the global profile role. It avoids recursive profile RLS today, yet it cannot answer “is this user an admin of this organization?”

### Application query and action assumptions

The following patterns assume one organization:

- Calendar, available-shift, schedule, admin-shift, and shift-detail queries have no `organization_id` predicate.
- The calendar loads all upcoming shifts. For a global admin it also loads all assignment counts.
- The admin staff page loads every profile whose global role is `staff`.
- Create, edit, delete, assignment, response review, staff creation, and password-reset actions authorize with `profile.role === "admin"`.
- Availability saving validates a shift by its ID, but not membership in the shift's organization.
- Assignment actions validate a shift, a global staff profile, and a requirement independently. There is no database key requiring all three to belong to the same tenant.
- `created_by` and `assigned_by` reference a global profile, not a membership in the affected organization.
- Requirement-role validity and capacity are protected partly in application code. They are not tenant-aware, and capacity checking consists of multiple PostgREST transactions.
- Create/edit flows use compensating cleanup because shift and requirement writes are separate requests. Tenant conversion must not make those recovery queries unscoped.
- Revalidation paths are global. That is functionally acceptable, but it may invalidate more tenants than necessary as the product grows.
- Both `lib/date.ts` and the calendar client use the fixed `America/Los_Angeles` timezone. “Today” and calendar formatting therefore assume one organization timezone.

### Privileged operations that bypass RLS

`createAdminClient()` is correctly server-only and uses `SUPABASE_SERVICE_ROLE_KEY`, but the service role bypasses every RLS policy. The normal-client checks immediately before an Auth Admin call are therefore the real security boundary.

Current privileged paths are:

1. Staff creation: a global admin calls `auth.admin.createUser()`. There is no target organization and no membership creation.
2. Staff password reset: a global admin verifies that the target global profile is `staff`, then calls `auth.admin.updateUserById()`.
3. Username change: the authenticated user updates their own profile, then the service client changes that same Auth user's synthetic email.

In a multi-organization system, an Auth user is a global identity. Resetting that user's password affects access to every organization they belong to. Membership-level admin rights must not silently imply authority over a person's global credentials without an explicit product and security decision.

### Storage observations

Avatar write policies are identity-scoped and do not currently permit an admin to write another user's object. This is compatible with a global person profile. However, the `avatars` bucket is public: anyone with the public URL can read an avatar regardless of the storage `SELECT` policy. Avatars must therefore be treated as public profile images, not confidential tenant data. If private employee photos are required later, use a private bucket and short-lived signed URLs after an organization membership check.

## Main architectural problems

1. **No tenant key:** scheduling records cannot be attributed to or filtered by an organization at the database level.
2. **Global authorization role:** one `profiles.role = 'admin'` grants authority over the entire installation.
3. **Permissive cross-tenant read policies:** all authenticated users can read all shifts and requirements.
4. **No relational tenant integrity:** a shift, responding user, assigned user, assigner, and requirement can only be correlated by application logic.
5. **No multi-membership identity model:** creating a staff account always creates a new global identity instead of adding an existing person to an organization.
6. **Brand-coupled login:** `@<domain>.local` is global, non-deliverable, tied to one customer name, and incompatible with ordinary recovery and identity verification.
7. **Global timezone:** current/upcoming boundaries and display assume Los Angeles.
8. **Service-role scope:** Auth Admin calls bypass RLS and currently rely on a global admin check.
9. **Public avatar reads:** current avatars are not confidential even though object writes are owner-only.
10. **No safe organization lifecycle:** there is no owner invariant, membership suspension, or protection against removing the last owner.

## Proposed target schema

### Global identity remains global

Keep `public.profiles` as the person-level extension of `auth.users`:

- `id`, `full_name`, `username`, and `avatar_path` remain global.
- Existing profile IDs and Auth relationships remain unchanged.
- Keep `profiles.role` temporarily for compatibility, but stop treating it as an authorization source after the RLS cutover.
- If an organization later needs a tenant-specific display name, job title, or employee number, add it to the membership or a separate organization-person table rather than duplicating Auth users.

### `organizations`

Minimum recommended fields:

| Field | Purpose |
| --- | --- |
| `id` UUID primary key | Stable tenant identifier |
| `name` text | Display name |
| `slug` text, normalized and unique | Human-readable organization identifier |
| `timezone` text | Canonical IANA timezone such as `America/Los_Angeles` |
| `settings` JSON object | Small organization-specific settings with an object-shape constraint |
| `created_by` UUID | Global profile that initiated creation; bootstrap may require a controlled exception |
| `created_at`, `updated_at` | Audit timestamps |

The application should validate timezones against PostgreSQL's known IANA timezone names through a database trigger/function in the eventual migration, not only in TypeScript. Arbitrary unvalidated timezone strings should not be accepted.

### `organization_memberships`

Minimum recommended fields:

| Field | Purpose |
| --- | --- |
| `organization_id` UUID | References `organizations` |
| `user_id` UUID | References `profiles` |
| `role` text | `owner`, `admin`, `manager`, or `staff` |
| `disabled_at` nullable timestamp | Revokes access while retaining historical foreign-key references |
| `created_by` nullable UUID | Person who added the membership; nullable only for controlled bootstrap |
| `created_at`, `updated_at` | Audit timestamps |

Use `(organization_id, user_id)` as the primary key. A person can then be a member of multiple organizations but can have only one active role in each. Access helpers must require `disabled_at IS NULL`.

Memberships should normally be disabled, not deleted. Historical shifts and assignments can continue to identify their creators and assigners without weakening referential integrity. Prevent the last active owner from being disabled or demoted through a transaction-safe database function; a UI check alone is insufficient.

Invitations, billing plans, teams, departments, and per-member job classifications are deliberately outside the minimal schema.

### Organization-scoped roles

| Capability | Owner | Admin | Manager | Staff |
| --- | --- | --- | --- | --- |
| View organization shifts | Yes | Yes | Yes | Yes |
| Submit own availability / view own assignments | Yes | Yes | Yes | Yes |
| Create, edit, delete shifts | Yes | Yes | Yes | No |
| Review all organization responses | Yes | Yes | Yes | No |
| Manage assignments | Yes | Yes | Yes | No |
| View organization roster | Yes | Yes | Yes | Limited/self unless required |
| Add or disable staff | Yes | Yes | No initially | No |
| Manage managers | Yes | Yes | No | No |
| Manage admins/owners | Yes | No | No | No |
| Organization settings/ownership | Yes | No by default | No | No |

This matrix should be implemented consistently in both Server Actions and RLS. If the product later changes a capability, change a centralized authorization definition and its database counterpart together.

### Tenant keys on scheduling tables

The durable target is to add a non-null `organization_id` to every tenant-owned table, not only to `shifts`:

- `shifts.organization_id`
- `shift_requirements.organization_id`
- `availability_responses.organization_id`
- `assignments.organization_id`

Although child organization IDs are redundant with the shift, they make policies, indexes, and database integrity explicit. They also prevent accidental cross-tenant joins and make future partitioning or tenant exports practical.

Use composite keys/constraints so the database enforces these relationships:

- A shift creator must have a membership in the same organization.
- A requirement's `(organization_id, shift_id)` must reference a shift in that organization.
- A response's shift and responding user must both belong to its organization.
- An assignment's shift, assigned user, and assigning user must all belong to its organization.
- An assignment role must reference a requirement on that same organization and shift, or assignments should eventually reference a requirement ID directly.

Keep existing row IDs, `user_id` values, and role text during the compatibility period. Do not rewrite historical identity keys.

Recommended indexes and uniqueness:

- Organizations: normalized unique slug.
- Memberships: primary key `(organization_id, user_id)`, plus `(user_id, organization_id)` and `(organization_id, role, user_id)`.
- Shifts: `(organization_id, date, start_time, id)`, `(organization_id, response_deadline)`, and a composite unique key usable by child foreign keys.
- Requirements: `(organization_id, shift_id)` and case-insensitive uniqueness of role within a shift.
- Responses: unique `(organization_id, shift_id, user_id)`, plus `(organization_id, user_id, shift_id)` and an admin-review index beginning with organization and shift.
- Assignments: unique `(organization_id, shift_id, user_id)`, plus `(organization_id, user_id, shift_id)` and `(organization_id, shift_id, assigned_role)`.

The current application performs a case-insensitive duplicate-role check, while the current database uniqueness is case-sensitive. The eventual database design should normalize a role key or otherwise enforce case-insensitive uniqueness. Assignment capacity also needs a transactional database operation or lock to eliminate races; that is separate from tenant isolation but should be addressed before high concurrency.

## Tenant context in the application

Introduce one server-only context helper that returns:

- the authenticated global profile;
- the selected organization;
- the active membership and organization role; and
- the organization timezone/settings needed by the request.

For the compatibility phase, existing URLs can resolve the sole legacy organization automatically. When multi-organization membership is enabled, prefer organization-scoped URLs such as `/org/[slug]/...`, or use a server-managed active-organization cookie as a transition. A route value or cookie is only a tenant selection hint: the server must verify an active membership on every request. Never trust it as authorization and never rely on a client-provided `organization_id` alone.

Do not put the active organization role only in long-lived JWT metadata. Membership changes and suspensions need to take effect immediately, and one person may have different roles in different organizations. The database membership row is the authority.

Every Server Action must independently resolve this context, authorize the required organization role, and add the organization predicate to reads, updates, and deletes. IDs remain useful for object lookup, but `id = submittedId` is never sufficient; queries must also match the authorized organization.

## RLS strategy

### Safe helper functions

Add tenant-aware database helpers in the private schema in a future migration, for example conceptually:

- `is_organization_member(organization_id)`
- `has_organization_role(organization_id, allowed_roles)`

If implemented as `SECURITY DEFINER`, they must keep the current good practices: empty/safe `search_path`, schema-qualified objects/functions, minimum execute grants, a controlled owner, and no dynamic SQL. This avoids recursive RLS on membership checks. The helper must always use `auth.uid()` internally and require an enabled membership.

Do not expose a helper that accepts an arbitrary user ID as proof of authority.

### Target policy behavior

| Table | Read | Write |
| --- | --- | --- |
| `organizations` | Enabled members of that organization | Owner for sensitive settings; organization creation through a controlled function |
| `organization_memberships` | Self; owners/admins/managers may read the roster needed for their duties | Prefer controlled functions; owners/admins within the role matrix; protect last owner |
| `profiles` | Self; otherwise only profiles connected through an organization the requester is authorized to inspect | Self-service fields only; no membership/role authority here |
| `shifts` | Enabled members of the row's organization | Owner/admin/manager of that organization |
| `shift_requirements` | Enabled members of the row's organization | Owner/admin/manager of that organization |
| `availability_responses` | Own row, or owner/admin/manager of that row's organization | User's own row while an enabled member and before the deadline; no submitted user override |
| `assignments` | Own row, or owner/admin/manager of that row's organization | Owner/admin/manager of that organization |

The response-deadline rule should continue in Server Actions and can also be represented in RLS with an organization-matched shift lookup. Database time is authoritative. Defense in depth is preferable to relying on a hidden/disabled button.

Replace broad policies such as authenticated `shifts_select_authenticated` and global `is_admin()` checks. Do not leave an old permissive policy alongside a new tenant policy: PostgreSQL permissive policies are combined with `OR`, so the old policy would defeat isolation.

Table grants and RLS must be reviewed together. RLS is not a substitute for keeping grants narrow, and grants alone do not provide row isolation.

### Example isolation properties to test

- A member of organization A cannot select a known shift ID from organization B.
- A manager in A is not a manager in B unless a second membership explicitly says so.
- A response user, shift, and organization cannot be mixed by a direct API request.
- An assigned user and assigning user must both be members of the assignment organization.
- Disabling a membership immediately blocks reads and writes without waiting for token refresh.
- A multi-organization user sees only the selected organization's calendar but retains the same Auth session.

## Protecting existing data types

### Profiles

Profiles stay global and are not duplicated per tenant. Organization roles move to memberships. Cross-profile reads must require a shared organization and an appropriate roster permission; a global username must not grant directory access. The legacy `role` column remains during rollout but is eventually deprecated.

### Shifts and requirements

Both receive the same organization ID, backed by a composite foreign key. Members read shifts only in organizations they belong to. Scheduling roles write only in their organization. Requirement rows cannot point to another tenant's shift.

### Availability responses

Each response carries an organization ID that must match both its shift and user membership. Staff retain own-row access. Managers, admins, and owners see responses only inside the relevant organization. No general staff query should load other members' responses.

### Assignments

Each assignment carries an organization ID. Composite constraints verify the shift, assigned member, assigner, and required role belong together. Staff read only their own rows. Scheduling roles manage rows only for their organization. Removing a member should disable membership rather than erase assignment history.

### Avatars

Existing UUID-based paths can remain as global identity avatars and do not need to be copied for the legacy organization. Self-write policies remain appropriate. Document that reads are public today. If organization-confidential photos are required, migrate to a private bucket and authorize signed URL generation using a shared enabled membership. An organization ID in a public object path does not make the object private.

## Authentication and username strategy

### Compatibility now

Do not change current login during the tenant data migration. Existing `auth.users` rows, IDs, passwords, synthetic emails, usernames, and sessions continue to work. The legacy organization is selected after authentication.

Username uniqueness must remain global while login maps a username without an organization qualifier. Allowing the same username in two organizations before changing login would make authentication ambiguous.

### Limitations of `@<domain>.local`

- It embeds one customer's name in a future shared product.
- `.local` is not a deliverable email domain, so normal verification and recovery cannot work.
- A profile username and Auth email must be kept synchronized across two systems.
- Organization admins creating accounts can accidentally create duplicate identities for the same person.
- Organization-scoped usernames conflict with a person belonging to multiple organizations.
- An organization administrator's password reset changes a global credential used by all of the person's memberships.

### Recommended eventual direction

Use one organization-independent identity per person, preferably a real verified email, passkey, or organization SSO identity, then select an organization after login. Keep username as a display/login handle if product requirements need it, but do not encode tenant membership into the Auth identity.

If a no-email visible login must remain, introduce a global login-identity mapping and use a stable product-owned synthetic identifier unrelated to an organization (for example, based on the Auth user UUID). The server can resolve a normalized global handle before password authentication. That flow requires enumeration protection, rate limiting, recovery design, and careful non-transactional identity updates. Do not use an organization slug in the synthetic email, because a multi-organization person must still have one identity.

During a later identity migration, continue accepting the legacy username mapping, attach the new verified identity to the same Auth user where supported, and preserve `auth.users.id`. Only retire `@<domain>.local` after all existing users have a tested replacement credential/recovery path.

## Privileged Auth Admin rules in the target system

Before every service-role operation:

1. Authenticate with the normal SSR client.
2. Resolve the requested organization through an enabled membership.
3. Authorize the exact capability using the requester's membership role.
4. Load and verify target membership with the normal client/RLS.
5. Derive target user IDs server-side; never trust role, username, email, or `assigned_by` from the form.
6. Invoke the service client only for the minimal Auth Admin method.
7. Record a tenant-scoped audit event without credentials or tokens.

Specific changes:

- **Create staff:** authorize owner/admin in the target organization. First determine whether the person already has a global identity. Create an Auth user only when necessary, then add a `staff` membership. If membership insertion fails after Auth creation, use an idempotent compensation path and record the orphan for repair. A database function can make membership creation atomic, but it cannot make the external Auth Admin call part of the same transaction.
- **Reset password:** treat this as global-identity administration, not ordinary tenant data administration. Decide explicitly whether an organization owner may reset a staff member who also belongs elsewhere. The safer default is self-service recovery or platform support; at minimum require a target membership in the same organization and prohibit resetting owners/admins through the staff workflow.
- **Change username:** keep the target fixed to `auth.uid()`. This is a self identity operation, not an organization-role operation. A future global handle remains unique across organizations.

Never use the service-role client for ordinary profiles, memberships, shifts, responses, or assignments. Those operations should use the normal authenticated client so RLS remains an active backstop.

## Timezone model

- Store one canonical IANA timezone per organization.
- Backfill the legacy organization with `America/Los_Angeles` to preserve current behavior.
- Treat existing `shifts.date`, `start_time`, and `end_time` as the organization's local wall-clock values. Continue parsing date-only strings without a JavaScript UTC conversion that can move them to another date.
- Keep `response_deadline` as an absolute `timestamptz`; format it in the organization's timezone.
- Compute “today” and upcoming filters from the selected organization's timezone, replacing both hardcoded application constants.
- Define timezone-change semantics before enabling edits. Changing a timezone can alter how existing deadlines are displayed and how wall-clock shifts are interpreted. The safest first version restricts timezone changes after shifts exist or makes the change affect future shifts only.
- Test daylight-saving gaps and repeated times. A later model may add absolute start/end timestamps, but that is not required for the first tenant migration.

## Backward-compatible migration strategy

All database work should be delivered in new migrations. Never edit the three existing migrations.

### Phase 1: preflight and additive foundation

1. Produce a read-only anomaly report: profiles without Auth users, duplicate/invalid usernames, shifts with missing creators, assignments with missing users/roles, and profile counts by global role.
2. Choose one existing admin explicitly as the legacy organization's initial owner. Do not pick an arbitrary row silently. If there is no suitable admin, stop the migration.
3. Add organizations, memberships, tenant helper functions, their indexes, and restrictive policies. This does not change current scheduling table policies yet.
4. Create one legacy organization representing the current installation with timezone `America/Los_Angeles`.
5. Add every existing profile as a member: selected admin to `owner`, other global admins to `admin`, and global staff to `staff`.

### Phase 2: backfill tenant ownership

1. Add nullable `organization_id` columns and supporting composite unique keys/indexes.
2. Backfill every existing shift to the legacy organization.
3. Backfill requirements, responses, and assignments from their shift's organization.
4. Validate that creators, responders, assigned users, and assigners have legacy memberships.
5. Add composite foreign keys as `NOT VALID` where PostgreSQL permits, validate them after backfill, then make tenant columns non-null.
6. Compare row counts and relationship counts before and after every step. No IDs or credentials are changed.

### Phase 3: tenant-aware application compatibility

1. Add a server-only authenticated organization context, initially defaulting single-membership users to the legacy organization.
2. Scope every read to the resolved organization, including calendar counts, staff lists, details, and compensating recovery queries.
3. Scope every update/delete by both object ID and organization ID.
4. Include the server-resolved organization ID on every new tenant row. Never accept it as authority from a form.
5. Replace global admin checks with membership capability checks while the legacy profile role remains available for rollback.
6. Make privileged account creation add a membership and enforce tenant authorization.
7. Run the application against two seeded organizations and a user with two memberships before changing production RLS.

### Phase 4: coordinated RLS cutover

Deploy application compatibility and the RLS policy replacement as one planned security release:

1. Confirm no production build still creates rows without organization IDs.
2. In one database transaction, remove the permissive/global policies and add all tenant-scoped policies and grants.
3. Test positive and negative access with anon, staff, manager, admin, owner, disabled member, and service-role contexts.
4. Monitor authorization failures and cross-tenant canary tests immediately after deployment.

The old and new policies must not coexist if an old permissive policy broadens access. The application must not be deployed tenant-aware while required columns/helpers are absent. These steps are separately testable and committable, but the production security cutover has a strict deployment dependency.

### Phase 5: multi-organization UX and cleanup

1. Add organization selection and organization-scoped URLs.
2. Add owner/admin membership management with last-owner protection.
3. Remove all authorization reads of `profiles.role`.
4. After a stabilization period, deprecate or remove `profiles.role` in a separate migration.
5. Migrate identity/login and avatar privacy only in later dedicated projects.

## Small follow-up milestones

Each item should be one reviewable commit with focused tests. Items marked **coordinated release** may be committed separately but must not be deployed in isolation.

1. **0B — Tenant threat matrix and preflight checks:** codify cross-tenant negative cases and a read-only legacy-data anomaly report.
2. **0C — Organization foundation:** add `organizations`, `organization_memberships`, role constraints, indexes, timestamps, and tenant helper tests; no scheduling-policy changes.
3. **0D — Legacy tenant seed:** create the legacy organization and memberships after an explicit owner is configured; verify every profile maps once.
4. **0E — Shift tenant key:** add/backfill nullable `shifts.organization_id`, indexes, creator membership integrity, and row-count checks.
5. **0F — Child tenant keys:** add/backfill organization IDs on requirements, responses, and assignments; verify all match their shift.
6. **0G — Relational isolation constraints:** add/validate composite foreign keys and uniqueness, then set tenant columns non-null.
7. **0H — Authenticated organization context:** add a server-only context helper with single-organization compatibility and tests for missing/disabled memberships.
8. **0I — Tenant-scoped reads:** update calendar, staff, shift, response, and assignment reads; verify two-organization isolation while writes remain compatibility-safe.
9. **0J — Tenant-scoped scheduling writes:** update create/edit/delete, response, assignment, and recovery/compensation queries to use server-resolved organization IDs.
10. **0K — Membership-aware account administration:** update staff creation and target verification; define and test the global password-reset rule.
11. **0L — RLS policy cutover:** replace global policies and grants, add owner/admin/manager/staff matrix tests. **Coordinated release with 0H–0K.**
12. **0M — Organization selection:** add organization-scoped URLs or a verified active-organization selector for multi-membership users.
13. **0N — Organization timezone:** replace hardcoded Los Angeles date boundaries/formatting and add DST/date-only tests.
14. **0O — Membership administration:** add invite/add/disable/role-change flows and transaction-safe last-owner protection.
15. **0P — Identity modernization:** migrate away from customer-branded synthetic emails without changing Auth user IDs.
16. **0Q — Legacy cleanup:** remove remaining `profiles.role` dependencies and only then consider dropping the column.
17. **0R — Avatar privacy decision:** formally retain public identity avatars or migrate to private, membership-authorized delivery.

## Rollout, rollback, and operational risks

### Highest risks

- **RLS data leak:** leaving one old permissive policy in place defeats new policies because permissive policies combine with `OR`.
- **RLS lockout:** switching policies before the app supplies organization context can block all production workflows.
- **Incorrect legacy ownership:** mapping the wrong admin to owner creates an authorization incident.
- **Orphaned relationships:** dirty historical data can prevent composite foreign-key validation.
- **Partial privileged provisioning:** Auth user creation and database membership insertion cannot share one transaction.
- **Global credential impact:** tenant administrators resetting a multi-organization user's password affect every membership.
- **Stale tenant selection:** a cookie or URL that is not revalidated can retain access after membership suspension.
- **Timezone drift:** changing hardcoded “today” logic can make shifts appear/disappear near midnight or DST boundaries.
- **Policy performance:** unindexed membership checks on every row can make calendar and admin queries slow.
- **Public avatar assumptions:** customers may incorrectly assume employee photos are tenant-private.

### Rollback boundaries

- Before any second organization receives data, additive columns/tables can remain unused while the app rolls back. Prefer leaving them in place over destructive rollback.
- The RLS cutover requires a tested reverse policy transaction, but reverting to globally permissive policies is acceptable only while the database still contains exactly one organization. Once multiple tenants exist, such a rollback would be a data breach.
- After multi-tenant writes begin, organization IDs and memberships are forward-only data. Do not drop or merge them during rollback; deploy a tenant-aware prior application version or forward-fix.
- Keep `profiles.role` and legacy context through the stabilization window, but never use the legacy role to bypass tenant RLS.
- Take a database backup before backfill and policy cutover, record row-count/checksum baselines, and rehearse restore in a non-production environment.
- Run foreign-key validation and large index creation with production table size/locking in mind. Schedule potentially blocking work separately.

### Release gates

Do not enable a second organization until all of the following pass:

- Every tenant-owned row has a non-null, validated organization ID.
- Every current query/action has an organization-scope test.
- Cross-organization direct API tests fail at RLS, even with known UUIDs.
- Service-role call sites have explicit normal-client tenant authorization and audit coverage.
- Disabled memberships lose access immediately.
- A multi-membership user can change organizations without changing identity.
- Legacy users can still log in with existing usernames and passwords.
- Timezone/date-only and DST tests pass for at least two different organization timezones.

## Recommended decisions before implementation

1. Identify the exact existing admin who becomes the legacy owner.
2. Decide whether organization admins may reset a person's global password when that person belongs to other organizations.
3. Decide whether avatars are intentionally public.
4. Decide whether managers can create staff memberships or only manage scheduling.
5. Choose organization-scoped URLs versus a verified active-organization cookie for the first multi-membership UX.
6. Define timezone-change behavior for organizations with existing shifts.

These decisions do not block the additive organization schema, but they do block a safe authorization and production rollout.
