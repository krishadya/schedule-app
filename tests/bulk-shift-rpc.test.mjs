import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20261026170000_create_recurring_shifts_rpc.sql",
);
const migration = readFileSync(migrationPath, "utf8");

test("bulk shift RPC exposes the required typed inputs and useful result", () => {
  assert.match(
    migration,
    /create function public\.create_recurring_shifts\([\s\S]*p_event_name text[\s\S]*p_occurrence_dates date\[\][\s\S]*p_start_time time without time zone[\s\S]*p_end_time time without time zone[\s\S]*p_location text[\s\S]*p_notes text[\s\S]*p_response_deadline timestamp with time zone[\s\S]*p_requirements jsonb[\s\S]*\)\s*returns integer/i,
  );
  assert.match(migration, /return created_count;/i);
});

test("bulk shift RPC independently authorizes the authenticated admin", () => {
  assert.match(migration, /security invoker/i);
  assert.match(migration, /set search_path = ''/i);
  assert.match(migration, /requesting_user_id uuid := auth\.uid\(\)/i);
  assert.match(migration, /if requesting_user_id is null then/i);
  assert.match(migration, /if not private\.is_admin\(\) then/i);
  assert.match(migration, /created_by[\s\S]*requesting_user_id/i);
  assert.match(
    migration,
    /revoke all on function public\.create_recurring_shifts\([\s\S]*from public, anon;/i,
  );
  assert.match(
    migration,
    /grant execute on function public\.create_recurring_shifts\([\s\S]*to authenticated;/i,
  );
});

test("bulk shift RPC performs shifts and requirements inserts atomically", () => {
  assert.match(migration, /insert into public\.shifts/i);
  assert.match(migration, /insert into public\.shift_requirements/i);
  assert.doesNotMatch(migration, /exception\s+when/i);
  assert.doesNotMatch(migration, /delete from public\.shifts/i);
  assert.doesNotMatch(migration, /service_role|service-role/i);
});

test("bulk shift RPC validates occurrence dates and the 120 shift limit", () => {
  assert.match(migration, /occurrence_count = 0/i);
  assert.match(migration, /occurrence_count > 120/i);
  assert.match(migration, /array_position\(p_occurrence_dates, null::date\)/i);
  assert.match(migration, /isfinite\(generated_date\.value\)/i);
  assert.match(migration, /distinct_occurrence_count <> occurrence_count/i);
});

test("bulk shift RPC validates schedule and staffing data", () => {
  assert.match(migration, /btrim\(p_event_name\) = ''/i);
  assert.match(migration, /p_end_time <= p_start_time/i);
  assert.match(migration, /isfinite\(p_response_deadline\)/i);
  assert.match(migration, /jsonb_array_length\(p_requirements\) = 0/i);
  assert.match(migration, /staff_needed[\s\S]*positive integer/i);
  assert.match(
    migration,
    /group by pg_catalog\.lower\([\s\S]*having pg_catalog\.count\(\*\) > 1/i,
  );
});
