import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

const root = process.cwd();
const shiftId = "11111111-1111-4111-8111-111111111111";
const requestId = "22222222-2222-4222-8222-222222222222";

function load(relativePath, modules = {}) {
  const filename = resolve(root, relativePath);
  const code = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const exports = {};
  runInNewContext(
    code,
    {
      exports,
      Date,
      Intl,
      FormData,
      require(name) {
        if (name in modules) return modules[name];
        throw new Error(`Unexpected import: ${name}`);
      },
    },
    { filename },
  );
  return exports;
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

const shared = load("lib/replacements/shared.ts");
const migration = readFileSync(
  resolve(root, "supabase/migrations/20261101120000_replacement_requests.sql"),
  "utf8",
);

test("missing replacement schema errors are recognised so pages can hide the feature", () => {
  assert.equal(shared.isMissingReplacementSchema({ code: "42P01" }), true);
  assert.equal(shared.isMissingReplacementSchema({ code: "PGRST205" }), true);
  assert.equal(shared.isMissingReplacementSchema({ code: "PGRST202" }), true);
  // Other errors that merely mention the table must not hide a real bug.
  assert.equal(
    shared.isMissingReplacementSchema({
      code: "PGRST200",
      message: "Could not find a relationship between 'replacement_requests' and 'profiles'",
    }),
    false,
  );
  assert.equal(shared.isMissingReplacementSchema({ code: "42501", message: "denied" }), false);
  assert.equal(shared.isMissingReplacementSchema(null), false);
});

test("the latest request per shift wins", () => {
  const latest = shared.latestRequestByShift([
    { id: "old", shift_id: "a", created_at: "2026-11-01T00:00:00Z" },
    { id: "new", shift_id: "a", created_at: "2026-11-03T00:00:00Z" },
    { id: "only", shift_id: "b", created_at: "2026-11-02T00:00:00Z" },
  ]);

  assert.equal(latest.get("a").id, "new");
  assert.equal(latest.get("b").id, "only");
});

test("migration enables RLS and limits staff to their own assigned shifts", () => {
  assert.match(migration, /alter table public\.replacement_requests enable row level security/);
  assert.match(migration, /revoke all privileges on table public\.replacement_requests\s+from anon, authenticated/);
  // Staff can't write status/resolution fields on insert.
  assert.match(migration, /grant insert \(shift_id, requested_by, reason\)/);
  assert.match(migration, /requested_by = \(select auth\.uid\(\)\)\s+and status = 'pending'\s+and exists \(\s+select 1\s+from public\.assignments/);
  // Staff may only move their own pending request to cancelled.
  assert.match(migration, /using \(\s+requested_by = \(select auth\.uid\(\)\)\s+and status = 'pending'\s+\)\s+with check \(\s+requested_by = \(select auth\.uid\(\)\)\s+and status = 'cancelled'/);
  assert.match(migration, /create unique index replacement_requests_one_pending_idx[\s\S]+where status = 'pending'/);
  assert.doesNotMatch(migration, /for delete/i);
});

test("resolution runs as one invoker function that only removes the requester's assignment on approval", () => {
  assert.match(migration, /create function public\.resolve_replacement_request\(/);
  assert.match(migration, /security invoker/);
  assert.match(migration, /set search_path = ''/);
  assert.match(migration, /if not private\.is_admin\(\) then/);
  assert.match(migration, /if request\.status <> 'pending' then/);
  assert.match(migration, /for update;/);
  assert.match(
    migration,
    /if p_approve then\s+delete from public\.assignments\s+where shift_id = request\.shift_id\s+and user_id = request\.requested_by;/,
  );
  assert.match(migration, /revoke all on function public\.resolve_replacement_request\(uuid, boolean, text\)\s+from public, anon;/);
  assert.doesNotMatch(migration, /security definer/i);
});

function loadScheduleActions({ shift, assignment, insertError = null } = {}) {
  const calls = { inserted: null, revalidated: [] };
  const supabase = {
    from(table) {
      const query = { table, filters: {} };
      const builder = {
        select() {
          return builder;
        },
        eq(column, value) {
          query.filters[column] = value;
          return builder;
        },
        async maybeSingle() {
          if (table === "shifts") return { data: shift, error: null };
          if (table === "assignments") return { data: assignment, error: null };
          return { data: null, error: null };
        },
        async insert(row) {
          calls.inserted = row;
          return { error: insertError };
        },
      };
      return builder;
    },
  };

  const actions = load("app/schedule/actions.ts", {
    "next/cache": {
      revalidatePath(path) {
        calls.revalidated.push(path);
      },
    },
    "@/lib/auth/profile": {
      async getAuthenticatedProfile() {
        return { id: "staff-id", role: "staff" };
      },
    },
    "@/lib/date": { getAppDateKey: () => "2026-11-04" },
    "@/lib/replacements/shared": shared,
    "@/lib/supabase/server": {
      async createClient() {
        return supabase;
      },
    },
  });

  return { actions, calls };
}

function form(values) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

const idle = { status: "idle", message: null };

test("staff request a replacement for their own upcoming assignment", async () => {
  const { actions, calls } = loadScheduleActions({
    shift: { id: shiftId, date: "2026-11-10" },
    assignment: { id: "a1" },
  });
  const result = await actions.requestReplacement(
    idle,
    form({ shiftId, reason: "  Exam that day  ", requestedBy: "someone-else" }),
  );

  assert.deepEqual(plain(result), { status: "success", message: "Replacement requested." });
  // The requester always comes from the session, never the form.
  assert.deepEqual(plain(calls.inserted), {
    shift_id: shiftId,
    requested_by: "staff-id",
    reason: "Exam that day",
  });
  assert.ok(calls.revalidated.includes(`/admin/shifts/${shiftId}`));
});

test("replacement requests are refused when not assigned, past, or already pending", async () => {
  let context = loadScheduleActions({ shift: { id: shiftId, date: "2026-11-10" }, assignment: null });
  let result = await context.actions.requestReplacement(idle, form({ shiftId }));
  assert.equal(result.message, "You are no longer assigned to this shift.");
  assert.equal(context.calls.inserted, null);

  context = loadScheduleActions({ shift: { id: shiftId, date: "2026-11-01" }, assignment: { id: "a1" } });
  result = await context.actions.requestReplacement(idle, form({ shiftId }));
  assert.equal(result.message, "This shift has already happened.");

  context = loadScheduleActions({
    shift: { id: shiftId, date: "2026-11-10" },
    assignment: { id: "a1" },
    insertError: { code: "23505" },
  });
  result = await context.actions.requestReplacement(idle, form({ shiftId }));
  assert.equal(result.message, "You already have a pending request for this shift.");

  context = loadScheduleActions({
    shift: { id: shiftId, date: "2026-11-10" },
    assignment: { id: "a1" },
    insertError: { code: "PGRST205", message: "Could not find the table" },
  });
  result = await context.actions.requestReplacement(idle, form({ shiftId }));
  assert.match(result.message, /aren't set up yet/);

  context = loadScheduleActions({ shift: null, assignment: null });
  result = await context.actions.requestReplacement(idle, form({ shiftId: "not-a-uuid" }));
  assert.equal(result.message, "Select a valid shift and try again.");
});

test("admin resolution goes through the atomic database function", () => {
  const source = readFileSync(
    resolve(root, "app/admin/shifts/[id]/replacement-actions.ts"),
    "utf8",
  );

  assert.match(source, /profile\.role !== "admin"/);
  assert.match(source, /\.rpc\("resolve_replacement_request"/);
  assert.doesNotMatch(source, /from\("assignments"\)/);
  assert.doesNotMatch(source, /supabase\/admin|SERVICE_ROLE/);
});

const coverage = load("lib/shifts/coverage.ts");
const notifications = load("lib/notifications/build.ts", {
  "../shifts/coverage": coverage,
});
const now = new Date("2026-11-04T18:00:00Z");

test("admins are notified about pending replacement requests", () => {
  const items = notifications.buildAdminNotifications({
    now,
    todayKey: "2026-11-04",
    timeZone: "America/Los_Angeles",
    shifts: [],
    pendingReplacements: [
      {
        id: requestId,
        shift_id: shiftId,
        requester_name: "Sam Lee",
        reason: "Exam",
        event_name: "Career Fair",
        date: "2026-11-10",
        start_time: "09:00:00",
      },
      {
        id: "past",
        shift_id: shiftId,
        requester_name: "Old",
        reason: null,
        event_name: "Gone",
        date: "2026-11-01",
        start_time: "09:00:00",
      },
    ],
  });

  assert.deepEqual(plain(items), [
    {
      id: `replacement:${requestId}`,
      title: "Sam Lee needs a replacement",
      detail: "Career Fair · Tue, Nov 10 at 9:00 AM · “Exam”",
      href: `/admin/shifts/${shiftId}`,
      tone: "amber",
      actionable: true,
    },
  ]);
});

test("staff hear back when a request is approved or declined", () => {
  const items = notifications.buildStaffNotifications({
    now,
    todayKey: "2026-11-04",
    timeZone: "America/Los_Angeles",
    shifts: [],
    respondedShiftIds: new Set(),
    assignments: [],
    resolvedReplacements: [
      {
        id: "r1",
        status: "approved",
        admin_note: null,
        resolved_at: "2026-11-04T10:00:00Z",
        event_name: "Career Fair",
        date: "2026-11-10",
      },
      {
        id: "r2",
        status: "declined",
        admin_note: "We're short that day",
        resolved_at: "2026-11-03T10:00:00Z",
        event_name: "Concert",
        date: "2026-11-12",
      },
      {
        id: "r3",
        status: "approved",
        admin_note: null,
        resolved_at: "2026-10-01T10:00:00Z",
        event_name: "Old",
        date: "2026-11-12",
      },
    ],
  });

  assert.deepEqual(
    plain(items.map((item) => [item.title, item.detail, item.actionable])),
    [
      [
        "Replacement declined for Concert",
        "Thu, Nov 12 · You're still assigned · “We're short that day”",
        false,
      ],
      [
        "Replacement approved for Career Fair",
        "Tue, Nov 10 · You're no longer on this shift",
        false,
      ],
    ],
  );
});
