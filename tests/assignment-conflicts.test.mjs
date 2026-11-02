import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

const root = process.cwd();
const filename = resolve(root, "lib/shifts/conflicts.ts");
const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const conflicts = {};
runInNewContext(compiled, { exports: conflicts }, { filename });

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function range(date, start, end) {
  return { date, start_time: start, end_time: end };
}

test("shifts on the same date with intersecting times overlap", () => {
  assert.equal(
    conflicts.shiftsOverlap(
      range("2026-11-02", "09:00:00", "15:00:00"),
      range("2026-11-02", "14:00:00", "18:00:00"),
    ),
    true,
  );
  assert.equal(
    conflicts.shiftsOverlap(
      range("2026-11-02", "09:00:00", "17:00:00"),
      range("2026-11-02", "10:00:00", "11:00:00"),
    ),
    true,
  );
});

test("back-to-back shifts do not overlap", () => {
  assert.equal(
    conflicts.shiftsOverlap(
      range("2026-11-02", "09:00:00", "12:00:00"),
      range("2026-11-02", "12:00:00", "15:00:00"),
    ),
    false,
  );
});

test("the same times on different dates do not overlap", () => {
  assert.equal(
    conflicts.shiftsOverlap(
      range("2026-11-02", "09:00:00", "15:00:00"),
      range("2026-11-03", "09:00:00", "15:00:00"),
    ),
    false,
  );
});

test("conflicts are grouped by staff member and skip non-overlapping shifts", () => {
  const target = { id: "target", ...range("2026-11-02", "09:00:00", "15:00:00") };
  const result = conflicts.findAssignmentConflicts(target, [
    {
      id: "afternoon",
      event_name: "Career Fair",
      ...range("2026-11-02", "13:00:00", "18:00:00"),
      assignments: [
        { user_id: "alex", assigned_role: "Technician" },
        { user_id: "sam", assigned_role: "Usher" },
      ],
    },
    {
      id: "morning",
      event_name: "Breakfast",
      ...range("2026-11-02", "07:00:00", "09:30:00"),
      assignments: [{ user_id: "alex", assigned_role: "Server" }],
    },
    {
      id: "evening",
      event_name: "Concert",
      ...range("2026-11-02", "15:00:00", "22:00:00"),
      assignments: [{ user_id: "jo", assigned_role: "Usher" }],
    },
    {
      id: "target",
      event_name: "Same shift",
      ...range("2026-11-02", "09:00:00", "15:00:00"),
      assignments: [{ user_id: "jo", assigned_role: "Usher" }],
    },
    {
      id: "unstaffed",
      event_name: "Empty",
      ...range("2026-11-02", "10:00:00", "11:00:00"),
      assignments: null,
    },
  ]);

  assert.deepEqual(plain([...result.keys()].sort()), ["alex", "sam"]);
  assert.deepEqual(plain(result.get("alex")), [
    {
      shiftId: "morning",
      eventName: "Breakfast",
      startTime: "07:00:00",
      endTime: "09:30:00",
      assignedRole: "Server",
    },
    {
      shiftId: "afternoon",
      eventName: "Career Fair",
      startTime: "13:00:00",
      endTime: "18:00:00",
      assignedRole: "Technician",
    },
  ]);
  assert.equal(result.has("jo"), false);
});

test("shift details loads the week's shifts for conflict warnings without changing assignment rules", () => {
  const detailPage = readFileSync(
    resolve(root, "app/admin/shifts/[id]/page.tsx"),
    "utf8",
  );
  const actions = readFileSync(
    resolve(root, "app/admin/shifts/[id]/actions.ts"),
    "utf8",
  );

  assert.match(detailPage, /\.gte\("date", weekStart\)/);
  assert.match(detailPage, /\.lte\("date", addDays\(weekStart, 6\)\)/);
  assert.match(
    detailPage,
    /findAssignmentConflicts\(\s*shift,\s*weekShiftsResult\.data\.filter\(\(other\) => other\.date === shift\.date\),?\s*\)/,
  );
  // Conflicts are a warning only; assigning is unchanged.
  assert.doesNotMatch(actions, /conflict/i);
});
