# Archived documents

These files describe a multi-tenant SaaS direction that was explored and then
**abandoned**. They are kept for history only and do not describe the current
design.

Schedule App is self-hosted: each installation runs against its own Supabase
project and serves one organization. There are no organizations, tenants, or
billing.

- `multi-tenant-architecture.md`: the original audit and SaaS plan.
- `tenant-preflight.md` and `legacy_data_checks.sql`: read-only data
  integrity checks written for that plan. The SQL only reads data and can
  still be useful as a general health check.
