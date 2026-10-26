import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

const root = process.cwd();

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8");
}

function loadTypeScript(relativePath, mocks = {}) {
  const filename = resolve(root, relativePath);
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const exports = {};

  runInNewContext(compiled, {
    exports,
    require(name) {
      if (name in mocks) return mocks[name];
      throw new Error(`Unexpected import: ${name}`);
    },
  }, { filename });

  return exports;
}

function loadRecurrence() {
  const validation = loadTypeScript("lib/shifts/validation.ts");

  return loadTypeScript("lib/shifts/recurrence.ts", {
    "./validation": validation,
  });
}

test("recurring shift route independently requires an admin profile", () => {
  const page = read("app/admin/shifts/recurring/page.tsx");

  assert.match(page, /getAuthenticatedProfile\(\)/);
  assert.match(page, /profile\.role\s*!==\s*"admin"/);
  assert.match(page, /redirect\("\/dashboard"\)/);
});

test("recurring weekdays default to weekdays and preserve multiple selections", () => {
  const { DEFAULT_REPEAT_DAYS, toggleRepeatDay } = loadRecurrence();

  assert.equal(
    DEFAULT_REPEAT_DAYS.join(","),
    "monday,tuesday,wednesday,thursday,friday",
  );

  const withWeekend = toggleRepeatDay(DEFAULT_REPEAT_DAYS, "saturday");
  assert.equal(
    withWeekend.join(","),
    "monday,tuesday,wednesday,thursday,friday,saturday",
  );

  const oneDay = ["monday"];
  assert.equal(toggleRepeatDay(oneDay, "monday"), oneDay);
});

test("recurrence generation supports one selected weekday", () => {
  const { generateRecurringDates } = loadRecurrence();
  const result = generateRecurringDates(
    "2024-01-01",
    "2024-01-10",
    ["wednesday"],
  );

  assert.equal(result.success, true);
  assert.equal(result.dates.join(","), "2024-01-03,2024-01-10");
});

test("recurrence generation supports multiple selected weekdays", () => {
  const { generateRecurringDates } = loadRecurrence();
  const result = generateRecurringDates(
    "2024-01-01",
    "2024-01-10",
    ["monday", "wednesday"],
  );

  assert.equal(result.success, true);
  assert.equal(
    result.dates.join(","),
    "2024-01-01,2024-01-03,2024-01-08,2024-01-10",
  );
});

test("Monday through Friday generates twenty inclusive November shifts", () => {
  const { generateRecurringDates } = loadRecurrence();
  const result = generateRecurringDates(
    "2026-11-02",
    "2026-11-27",
    ["monday", "tuesday", "wednesday", "thursday", "friday"],
  );

  assert.equal(result.success, true);
  assert.equal(result.dates.length, 20);
  assert.equal(result.dates[0], "2026-11-02");
  assert.equal(result.dates.at(-1), "2026-11-27");
});

test("recurrence generation includes matching start and end boundaries", () => {
  const { generateRecurringDates } = loadRecurrence();
  const result = generateRecurringDates(
    "2024-01-01",
    "2024-01-05",
    ["monday", "friday"],
  );

  assert.equal(result.success, true);
  assert.equal(result.dates.join(","), "2024-01-01,2024-01-05");
});

test("recurrence generation crosses month boundaries chronologically", () => {
  const { generateRecurringDates } = loadRecurrence();
  const result = generateRecurringDates(
    "2024-01-26",
    "2024-02-05",
    ["monday", "friday"],
  );

  assert.equal(result.success, true);
  assert.equal(
    result.dates.join(","),
    "2024-01-26,2024-01-29,2024-02-02,2024-02-05",
  );
});

test("recurrence generation crosses year boundaries chronologically", () => {
  const { generateRecurringDates } = loadRecurrence();
  const result = generateRecurringDates(
    "2024-12-30",
    "2025-01-02",
    ["monday", "thursday"],
  );

  assert.equal(result.success, true);
  assert.equal(result.dates.join(","), "2024-12-30,2025-01-02");
});

test("recurrence generation includes leap day on its matching weekday", () => {
  const { generateRecurringDates } = loadRecurrence();
  const result = generateRecurringDates(
    "2024-02-28",
    "2024-03-01",
    ["thursday"],
  );

  assert.equal(result.success, true);
  assert.equal(result.dates.join(","), "2024-02-29");
});

test("recurrence generation reports no occurrences when no dates match", () => {
  const { generateRecurringDates } = loadRecurrence();
  const result = generateRecurringDates(
    "2024-01-01",
    "2024-01-01",
    ["tuesday"],
  );

  assert.equal(result.success, true);
  assert.equal(result.dates.length, 0);
});

test("recurrence generation rejects schedules above the preview limit", () => {
  const { generateRecurringDates, WEEKDAYS } = loadRecurrence();
  const result = generateRecurringDates(
    "2024-01-01",
    "2024-05-01",
    WEEKDAYS.map(({ value }) => value),
  );

  assert.equal(result.success, false);
  assert.equal(result.reason, "limit-exceeded");
  assert.match(result.error, /more than 120 shifts/);
  assert.equal("dates" in result, false);
});

test("recurring preview validation reuses shift staffing rules", () => {
  const { validateRecurringShiftDraft } = loadRecurrence();
  const baseDraft = {
    eventName: "Table Squad",
    startDate: "2026-11-02",
    endDate: "2026-11-27",
    selectedDays: ["monday"],
    startTime: "09:00",
    endTime: "17:00",
    location: "Hall A",
    notes: "",
    responseDeadline: "2026-10-30T17:00",
    requirements: [{ role: "Technician", count: "2" }],
  };

  assert.equal(validateRecurringShiftDraft(baseDraft).success, true);
  assert.match(
    validateRecurringShiftDraft({
      ...baseDraft,
      requirements: [
        { role: "Technician", count: "2" },
        { role: "technician", count: "1" },
      ],
    }).error,
    /unique/,
  );
  assert.match(
    validateRecurringShiftDraft({
      ...baseDraft,
      endTime: "08:00",
    }).error,
    /later than/,
  );
});

test("recurring form is local-only and exposes the required controls", () => {
  const form = read(
    "app/admin/shifts/recurring/recurring-shift-form.tsx",
  );
  const requirements = read(
    "app/admin/shifts/staff-requirements-fieldset.tsx",
  );
  const preview = read(
    "app/admin/shifts/recurring/recurring-shift-preview.tsx",
  );

  assert.doesNotMatch(form, /supabase|createClient|useActionState|server action/i);
  assert.match(form, /onSubmit=\{previewShifts\}/);
  assert.match(form, /aria-pressed=\{isSelected\}/);
  assert.equal([...form.matchAll(/type="date"/g)].length, 2);
  assert.equal([...form.matchAll(/type="time"/g)].length, 2);
  assert.match(form, /type="datetime-local"/);
  assert.match(form, /grid-cols-2[\s\S]*sm:grid-cols-4[\s\S]*lg:grid-cols-7/);
  assert.match(form, /type="submit"[\s\S]*Preview Shifts/);
  assert.match(form, /invalidatePreview\(\)/);
  assert.match(preview, /Create All Shifts/);
  assert.match(preview, /disabled/);
  assert.match(preview, /Bulk saving will be enabled in the next milestone\./);
  assert.match(requirements, /Add Role/);
  assert.match(requirements, /Remove Role/);
  assert.match(requirements, /requirements\.length\s*<=\s*1/);
});

test("existing shift form keeps its original action and requirement payload", () => {
  const shiftForm = read("app/admin/shifts/shift-form.tsx");

  assert.match(shiftForm, /<form action=\{formAction\}/);
  assert.match(shiftForm, /name="requirements"/);
  assert.match(shiftForm, /JSON\.stringify/);
  assert.match(shiftForm, /<StaffRequirementsFieldset/);
});
