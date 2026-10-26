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

function loadFormState() {
  const filename = resolve(
    root,
    "app/admin/shifts/recurring/recurring-form-state.ts",
  );
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const exports = {};

  runInNewContext(compiled, { exports }, { filename });

  return exports;
}

test("recurring shift route independently requires an admin profile", () => {
  const page = read("app/admin/shifts/recurring/page.tsx");

  assert.match(page, /getAuthenticatedProfile\(\)/);
  assert.match(page, /profile\.role\s*!==\s*"admin"/);
  assert.match(page, /redirect\("\/dashboard"\)/);
});

test("recurring weekdays default to weekdays and preserve multiple selections", () => {
  const { DEFAULT_REPEAT_DAYS, toggleRepeatDay } = loadFormState();

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

test("recurring form is local-only and exposes the required controls", () => {
  const form = read(
    "app/admin/shifts/recurring/recurring-shift-form.tsx",
  );
  const requirements = read(
    "app/admin/shifts/staff-requirements-fieldset.tsx",
  );

  assert.doesNotMatch(form, /supabase|createClient|useActionState|server action/i);
  assert.match(form, /onSubmit=\{\(event\) => event\.preventDefault\(\)\}/);
  assert.match(form, /aria-pressed=\{isSelected\}/);
  assert.equal([...form.matchAll(/type="date"/g)].length, 2);
  assert.equal([...form.matchAll(/type="time"/g)].length, 2);
  assert.match(form, /type="datetime-local"/);
  assert.match(form, /grid-cols-2[\s\S]*sm:grid-cols-4[\s\S]*lg:grid-cols-7/);
  assert.match(form, /Preview Recurring Shifts/);
  assert.match(form, /<button[\s\S]*?type="button"[\s\S]*?disabled[\s\S]*?>[\s\S]*?Preview Recurring Shifts/);
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
