import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

// Exercise the real validation and Server Actions against an isolated in-memory
// client. These tests never load credentials or contact Supabase.
const root = process.cwd();
const shiftId = "11111111-1111-4111-8111-111111111111";
const requirementId = "22222222-2222-4222-8222-222222222222";

function loadModule(relativePath, mocks = {}) {
  const filename = resolve(root, relativePath);
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  runInNewContext(compiled, {
    exports, FormData, Date, crypto: { randomUUID },
    require(name) {
      if (name in mocks) return mocks[name];
      if (name.startsWith("@/")) return loadModule(`${name.slice(2)}.ts`, mocks);
      throw new Error(`Unexpected import: ${name}`);
    },
  }, { filename });
  return exports;
}

function form(requirements = [{ role: "Technician", count: 2 }]) {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    eventName: "Updated event", date: "2026-10-10", startTime: "08:00",
    endTime: "17:00", responseDeadline: "2026-10-08T17:00:00Z",
    location: "Annex 1", notes: "Updated notes", requirements: JSON.stringify(requirements),
  })) data.set(key, value);
  return data;
}

function setup({ role = "admin", authenticated = true, fail, afterQuery } = {}) {
  const db = {
    shifts: [{ id: shiftId, event_name: "Original event", date: "2026-10-09",
      start_time: "09:00", end_time: "18:00", response_deadline: "2026-10-07T17:00:00Z",
      location: null, notes: null, updated_at: "version-0" }],
    shift_requirements: [{ id: requirementId, shift_id: shiftId, role: "Technician", staff_needed: 2 }],
    assignments: [],
  };
  const trace = [];
  const refreshed = [];
  let version = 0;
  const client = {
    from(table) {
      let operation = "select", payload, singular = false;
      const filters = [];
      const query = {
        select() { return query; },
        eq(key, value) { filters.push((row) => row[key] === value); return query; },
        is(key, value) { return query.eq(key, value); },
        in(key, values) { filters.push((row) => values.includes(row[key])); return query; },
        maybeSingle() { singular = true; return query; },
        update(value) { operation = "update"; payload = value; return query; },
        upsert(value) { operation = "upsert"; payload = value; return query; },
        delete() { operation = "delete"; return query; },
        then(onSuccess, onError) {
          return Promise.resolve().then(() => {
            const entry = { table, operation };
            trace.push(entry);
            if (fail?.(entry, trace)) return { data: null, error: { code: "test_failure" }, count: null };
            let rows = db[table].filter((row) => filters.every((filter) => filter(row)));
            if (operation === "update") {
              rows.forEach((row) => Object.assign(row, payload, { updated_at: `version-${++version}` }));
            } else if (operation === "upsert") {
              for (const value of payload) {
                const existing = db[table].find((row) => row.shift_id === value.shift_id && row.role === value.role);
                if (existing) Object.assign(existing, value);
                else db[table].push({ ...value });
              }
              rows = payload;
            } else if (operation === "delete") {
              db[table] = db[table].filter((row) => !rows.includes(row));
            }
            const result = { data: structuredClone(singular ? rows[0] ?? null : rows), error: null, count: rows.length };
            afterQuery?.(entry, db, trace);
            return result;
          }).then(onSuccess, onError);
        },
      };
      return query;
    },
  };
  const actions = loadModule("app/admin/shifts/[id]/shift-actions.ts", {
    "next/navigation": { redirect(path) { throw new Error(`REDIRECT:${path}`); } },
    "next/cache": { revalidatePath(path) { refreshed.push(path); } },
    "@/lib/auth/profile": { async getAuthenticatedProfile() {
      if (!authenticated) throw new Error("REDIRECT:/login");
      return { id: "admin-id", role };
    } },
    "@/lib/supabase/server": { async createClient() { return client; } },
  });
  return { db, trace, refreshed, ...actions };
}

test("shared validation rejects missing, malformed, duplicate and invalid values", () => {
  const { parseShiftForm } = loadModule("lib/shifts/validation.ts");
  assert.equal(parseShiftForm(form()).success, true);
  for (const [key, value] of [
    ["eventName", " "], ["date", "2026-02-30"], ["startTime", "25:00"],
    ["endTime", "07:00"], ["responseDeadline", "invalid"],
    ["requirements", "[]"], ["requirements", "not json"],
    ["requirements", JSON.stringify([{ role: " ", count: 1 }])],
    ["requirements", JSON.stringify([{ role: "Technician", count: 1.5 }])],
    ["requirements", JSON.stringify([{ role: "Technician", count: 0 }])],
    ["requirements", JSON.stringify([{ role: "Technician", count: 1 }, { role: "technician", count: 1 }])],
  ]) {
    const data = form(); data.set(key, value);
    assert.equal(parseShiftForm(data).success, false, `${key}: ${value}`);
  }
});

test("edit and delete independently reject unauthenticated and staff callers", async () => {
  for (const options of [{ authenticated: false }, { role: "staff" }]) {
    const context = setup(options);
    const target = options.authenticated === false ? "/login" : "/dashboard";
    await assert.rejects(context.editShift(shiftId, "version-0", {}, form()), { message: `REDIRECT:${target}` });
    await assert.rejects(context.deleteShift(shiftId, {}, new FormData()), { message: `REDIRECT:${target}` });
    assert.equal(context.trace.length, 0);
  }
});

test("assigned roles cannot be removed, renamed, recased or reduced below capacity", async () => {
  for (const requirements of [
    [{ role: "Manager", count: 2 }], [{ role: "technician", count: 2 }],
    [{ role: "Technician", count: 1 }],
  ]) {
    const context = setup();
    context.db.assignments.push({ shift_id: shiftId, assigned_role: "Technician" }, { shift_id: shiftId, assigned_role: "Technician" });
    const result = await context.editShift(shiftId, "version-0", {}, form(requirements));
    assert.match(result.error, /assigned staff/);
    assert.equal(context.trace.some((row) => row.operation !== "select"), false);
  }
});

test("stale and nonexistent shift edits do not write", async () => {
  const context = setup();
  assert.match((await context.editShift(shiftId, "old-version", {}, form())).error, /has changed/);
  context.db.shifts = [];
  assert.match((await context.editShift(shiftId, "version-0", {}, form())).error, /no longer exists/);
  assert.equal(context.trace.some((row) => row.operation !== "select"), false);
});

test("successful editing replaces unassigned roles and refreshes all affected pages", async () => {
  const context = setup();
  await assert.rejects(context.editShift(shiftId, "version-0", {}, form([{ role: "Manager", count: 3 }])), {
    message: `REDIRECT:/admin/shifts/${shiftId}`,
  });
  assert.equal(context.db.shifts[0].event_name, "Updated event");
  assert.equal(context.db.shift_requirements.length, 1);
  assert.equal(context.db.shift_requirements[0].role, "Manager");
  assert.equal(context.db.shift_requirements[0].staff_needed, 3);
  assert.ok(context.refreshed.includes("/schedule"));
  assert.ok(context.refreshed.includes("/shifts"));
  assert.equal(context.trace.some((row) => row.table === "assignments" && row.operation !== "select"), false);
});

test("bulk upsert failure restores original shift fields", async () => {
  let failed = false;
  const context = setup({ fail(entry) {
    if (entry.operation === "upsert" && !failed) { failed = true; return true; }
  } });
  const result = await context.editShift(shiftId, "version-0", {}, form());
  assert.match(result.error, /Original values were restored/);
  assert.equal(context.db.shifts[0].event_name, "Original event");
  assert.equal(context.db.shift_requirements[0].id, requirementId);
});

test("obsolete-role deletion failure restores requirements and removes new rows", async () => {
  let failed = false;
  const context = setup({ fail(entry) {
    if (entry.table === "shift_requirements" && entry.operation === "delete" && !failed) {
      failed = true; return true;
    }
  } });
  const result = await context.editShift(shiftId, "version-0", {}, form([{ role: "Manager", count: 1 }]));
  assert.match(result.error, /Original values were restored/);
  assert.equal(context.db.shift_requirements.length, 1);
  assert.equal(context.db.shift_requirements[0].role, "Technician");
  assert.equal(context.db.shifts[0].event_name, "Original event");
});

test("restoration failure is explicitly reported without a success redirect", async () => {
  const context = setup({ fail: (entry) => entry.operation === "upsert" });
  const result = await context.editShift(shiftId, "version-0", {}, form());
  assert.match(result.error, /could not be completed or fully restored/);
});

test("an assignment arriving during editing triggers recovery", async () => {
  const context = setup({ afterQuery(entry, db) {
    if (entry.table === "shift_requirements" && entry.operation === "upsert" && db.assignments.length === 0) {
      db.assignments.push({ shift_id: shiftId, assigned_role: "Technician" });
    }
  } });
  const result = await context.editShift(shiftId, "version-0", {}, form([{ role: "Manager", count: 1 }]));
  assert.match(result.error, /Original values were restored/);
  assert.equal(context.db.shift_requirements[0].role, "Technician");
});

test("delete requires confirmation and targets only the specified shift", async () => {
  const context = setup();
  const otherId = "33333333-3333-4333-8333-333333333333";
  context.db.shifts.push({ id: otherId });
  assert.match((await context.deleteShift(shiftId, {}, new FormData())).error, /Confirm deletion/);
  assert.equal(context.db.shifts.length, 2);
  const data = new FormData(); data.set("confirmation", "delete");
  await assert.rejects(context.deleteShift(shiftId, {}, data), { message: "REDIRECT:/admin/shifts" });
  assert.equal(context.db.shifts.length, 1);
  assert.equal(context.db.shifts[0].id, otherId);
  assert.equal(context.trace.filter((entry) => entry.operation === "delete").length, 1);
});
