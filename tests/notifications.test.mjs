import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

const root = process.cwd();

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
      require(name) {
        if (name in modules) return modules[name];
        throw new Error(`Unexpected import: ${name}`);
      },
    },
    { filename },
  );
  return exports;
}

const coverage = load("lib/shifts/coverage.ts");
const notifications = load("lib/notifications/build.ts", {
  "../shifts/coverage": coverage,
});

const now = new Date("2026-11-04T18:00:00Z"); // Wed Nov 4, 10:00 AM Pacific
const todayKey = "2026-11-04";
const timeZone = "America/Los_Angeles";

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function staffShift(id, date, deadline, start = "09:00:00") {
  return {
    id,
    event_name: `Event ${id}`,
    date,
    start_time: start,
    response_deadline: deadline,
  };
}

test("staff see open shifts that still need their response, soonest deadline first", () => {
  const items = notifications.buildStaffNotifications({
    now,
    todayKey,
    timeZone,
    shifts: [
      staffShift("later", "2026-11-20", "2026-11-15T20:00:00Z"),
      staffShift("urgent", "2026-11-10", "2026-11-04T23:00:00Z"),
      staffShift("answered", "2026-11-12", "2026-11-10T20:00:00Z"),
      staffShift("closed", "2026-11-12", "2026-11-03T20:00:00Z"),
      staffShift("past", "2026-11-01", "2026-11-05T20:00:00Z"),
    ],
    respondedShiftIds: new Set(["answered"]),
    assignments: [],
  });

  assert.deepEqual(
    plain(items.map((item) => [item.id, item.tone, item.actionable])),
    [
      ["respond:urgent", "amber", true],
      ["respond:later", "indigo", true],
    ],
  );
  assert.equal(items[0].detail, "Tue, Nov 10 at 9:00 AM · Due in 5 hours");
  assert.equal(items[0].href, "/shifts#shift-urgent");
  assert.match(items[1].detail, /Due Sun, Nov 15, 12:00 PM/);
});

test("assigned shifts never ask for a response", () => {
  const items = notifications.buildStaffNotifications({
    now,
    todayKey,
    timeZone,
    shifts: [staffShift("mine", "2026-11-20", "2026-11-15T20:00:00Z")],
    respondedShiftIds: new Set(),
    assignments: [
      { shift_id: "mine", assigned_role: "Technician", assigned_at: "2026-10-01T00:00:00Z" },
    ],
  });

  assert.deepEqual(plain(items), []);
});

test("staff get reminders for today and tomorrow, and news of recent assignments", () => {
  const items = notifications.buildStaffNotifications({
    now,
    todayKey,
    timeZone,
    shifts: [
      staffShift("today", "2026-11-04", "2026-11-01T20:00:00Z", "14:00:00"),
      staffShift("tomorrow", "2026-11-05", "2026-11-01T20:00:00Z"),
      staffShift("new", "2026-11-12", "2026-11-01T20:00:00Z"),
      staffShift("old", "2026-11-13", "2026-11-01T20:00:00Z"),
    ],
    respondedShiftIds: new Set(),
    assignments: [
      { shift_id: "new", assigned_role: "Usher", assigned_at: "2026-11-03T18:00:00Z" },
      { shift_id: "old", assigned_role: "Usher", assigned_at: "2026-10-01T18:00:00Z" },
      { shift_id: "tomorrow", assigned_role: "Technician", assigned_at: "2026-11-03T18:00:00Z" },
      { shift_id: "today", assigned_role: "Technician", assigned_at: null },
    ],
  });

  assert.deepEqual(
    plain(items.map((item) => [item.title, item.tone, item.actionable])),
    [
      ["Today: Event today", "indigo", false],
      ["Tomorrow: Event tomorrow", "indigo", false],
      ["You're assigned to Event new", "emerald", false],
    ],
  );
  assert.equal(items[0].detail, "Starts at 2:00 PM · Technician");
});

function adminShift(id, date, deadline, { requirements = [], assigned = [], responses = [] } = {}) {
  return {
    id,
    event_name: `Event ${id}`,
    date,
    start_time: "09:00:00",
    response_deadline: deadline,
    shift_requirements: requirements,
    assignments: assigned.map((role) => ({ assigned_role: role })),
    availability_responses: responses,
  };
}

test("admins are asked to staff shifts after responses close or when starting soon", () => {
  const tech2 = [{ role: "Technician", staff_needed: 2 }];
  const items = notifications.buildAdminNotifications({
    now,
    todayKey,
    timeZone,
    shifts: [
      adminShift("closed", "2026-11-20", "2026-11-02T20:00:00Z", {
        requirements: tech2,
        assigned: ["Technician"],
        responses: [
          { response: "yes", updated_at: "2026-10-20T00:00:00Z" },
          { response: "no", updated_at: "2026-10-20T00:00:00Z" },
        ],
      }),
      adminShift("soon", "2026-11-09", "2026-11-08T20:00:00Z", { requirements: tech2 }),
      adminShift("far-open", "2026-11-25", "2026-11-20T20:00:00Z", { requirements: tech2 }),
      adminShift("full", "2026-11-06", "2026-11-02T20:00:00Z", {
        requirements: tech2,
        assigned: ["Technician", "Technician"],
      }),
      adminShift("no-reqs", "2026-11-06", "2026-11-02T20:00:00Z"),
      adminShift("past", "2026-11-01", "2026-10-30T20:00:00Z", { requirements: tech2 }),
    ],
  });

  assert.deepEqual(
    plain(items.map((item) => [item.id, item.actionable])),
    [
      ["staff:soon", true],
      ["staff:closed", true],
    ],
  );
  assert.equal(items[0].detail, "Mon, Nov 9 · Starting soon · 2 open slots · 0 said yes");
  assert.equal(items[1].detail, "Fri, Nov 20 · Responses closed · 1 open slot · 1 said yes");
  assert.equal(items[1].href, "/admin/shifts/closed");
});

test("admins see recent availability responses grouped by shift", () => {
  const items = notifications.buildAdminNotifications({
    now,
    todayKey,
    timeZone,
    shifts: [
      adminShift("busy", "2026-11-25", "2026-11-20T20:00:00Z", {
        requirements: [{ role: "Usher", staff_needed: 1 }],
        responses: [
          { response: "yes", updated_at: "2026-11-04T10:00:00Z" },
          { response: "yes", updated_at: "2026-11-03T10:00:00Z" },
          { response: "maybe", updated_at: "2026-11-02T10:00:00Z" },
          { response: "no", updated_at: "2026-10-01T10:00:00Z" },
        ],
      }),
    ],
  });

  assert.deepEqual(plain(items), [
    {
      id: "responses:busy",
      title: "3 new responses for Event busy",
      detail: "Wed, Nov 25 · 2 yes · 1 maybe",
      href: "/admin/shifts/busy",
      tone: "slate",
      actionable: false,
    },
  ]);
});

test("notification data uses the normal signed-in client and never the service role", () => {
  const source = readFileSync(resolve(root, "lib/notifications/data.ts"), "utf8");
  const layout = readFileSync(resolve(root, "components/authenticated-layout.tsx"), "utf8");

  assert.match(source, /from "@\/lib\/supabase\/server"/);
  assert.doesNotMatch(source, /supabase\/admin|SERVICE_ROLE/);
  assert.match(source, /\.eq\("user_id", userId\)/);
  // A notification failure must not break every page.
  assert.match(layout, /\.catch\(\(\) => 0\)/);
});
