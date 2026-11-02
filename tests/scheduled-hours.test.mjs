import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

const root = process.cwd();

function compile(relativePath) {
  const filename = resolve(root, relativePath);
  return {
    filename,
    code: ts.transpileModule(readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
  };
}

const conflictsModule = {};
{
  const { filename, code } = compile("lib/shifts/conflicts.ts");
  runInNewContext(code, { exports: conflictsModule }, { filename });
}

const hours = {};
{
  const { filename, code } = compile("lib/shifts/hours.ts");
  runInNewContext(
    code,
    {
      exports: hours,
      Date,
      require(name) {
        if (name === "./conflicts") return conflictsModule;
        throw new Error(`Unexpected import: ${name}`);
      },
    },
    { filename },
  );
}

function shift(date, start, end) {
  return { date, start_time: start, end_time: end };
}

test("shift length is measured in minutes", () => {
  assert.equal(hours.getShiftMinutes(shift("2026-11-02", "09:00:00", "15:00:00")), 360);
  assert.equal(hours.getShiftMinutes(shift("2026-11-02", "20:00:00", "23:59:00")), 239);
  assert.equal(hours.getShiftMinutes(shift("2026-11-02", "09:30:00", "11:00:00")), 90);
});

test("weeks start on Monday, including across month and year boundaries", () => {
  assert.equal(hours.getWeekStart("2026-11-02"), "2026-11-02"); // Monday
  assert.equal(hours.getWeekStart("2026-11-08"), "2026-11-02"); // Sunday
  assert.equal(hours.getWeekStart("2026-11-01"), "2026-10-26"); // Sunday
  assert.equal(hours.getWeekStart("2027-01-01"), "2026-12-28"); // Friday
  assert.equal(hours.getWeekStart("2028-03-01"), "2028-02-28"); // leap year
});

test("dates are added without daylight-saving drift", () => {
  assert.equal(hours.addDays("2026-10-31", 1), "2026-11-01");
  assert.equal(hours.addDays("2026-11-01", 1), "2026-11-02");
  assert.equal(hours.addDays("2026-12-28", 6), "2027-01-03");
});

test("weekly totals split this week and next week", () => {
  const shifts = [
    shift("2026-10-26", "09:00:00", "17:00:00"), // last week
    shift("2026-11-02", "09:00:00", "15:00:00"), // this Monday, 6h
    shift("2026-11-08", "10:00:00", "11:30:00"), // this Sunday, 1h 30m
    shift("2026-11-09", "09:00:00", "13:00:00"), // next Monday, 4h
    shift("2026-11-16", "09:00:00", "13:00:00"), // in two weeks
  ];

  const result = hours.getWeeklyMinutes(shifts, "2026-11-04");
  assert.equal(result.thisWeek, 450);
  assert.equal(result.nextWeek, 240);
  assert.deepEqual(
    JSON.parse(JSON.stringify(hours.getWeeklyMinutes([], "2026-11-04"))),
    { thisWeek: 0, nextWeek: 0 },
  );
});

test("durations are formatted compactly", () => {
  assert.equal(hours.formatMinutes(0), "0h");
  assert.equal(hours.formatMinutes(45), "45m");
  assert.equal(hours.formatMinutes(360), "6h");
  assert.equal(hours.formatMinutes(450), "7h 30m");
});

test("hours pages count confirmed assignments, not availability", () => {
  for (const page of [
    "app/schedule/page.tsx",
    "app/admin/staff/page.tsx",
    "app/admin/shifts/[id]/page.tsx",
  ]) {
    const source = readFileSync(resolve(root, page), "utf8");
    assert.match(source, /formatMinutes/, page);
    assert.doesNotMatch(source, /createAdminClient|SUPABASE_SERVICE_ROLE_KEY/, page);
  }

  const staffPage = readFileSync(resolve(root, "app/admin/staff/page.tsx"), "utf8");
  assert.match(staffPage, /assignments \( user_id \)/);
});
