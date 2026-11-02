import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

const root = process.cwd();
const shiftId = "11111111-1111-4111-8111-111111111111";

function createElement(type, props) {
  return { type, props: props ?? {} };
}

function findElement(node, type) {
  if (!node || typeof node !== "object") {
    return null;
  }

  if (node.type === type) {
    return node;
  }

  const children = node.props?.children;

  if (Array.isArray(children)) {
    for (const child of children) {
      const match = findElement(child, type);
      if (match) return match;
    }
    return null;
  }

  return findElement(children, type);
}

function loadNewShiftPage({ role = "admin", shift = null, queryError = null } = {}) {
  const filename = resolve(root, "app/admin/shifts/new/page.tsx");
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const exports = {};
  const query = { selected: null, id: null, clientCreated: false };
  const CreateShiftForm = function CreateShiftForm() {};
  const queryBuilder = {
    select(columns) {
      query.selected = columns;
      return queryBuilder;
    },
    eq(column, value) {
      assert.equal(column, "id");
      query.id = value;
      return queryBuilder;
    },
    async maybeSingle() {
      return { data: shift, error: queryError };
    },
  };

  runInNewContext(compiled, {
    exports,
    Date,
    require(name) {
      if (name === "react/jsx-runtime") {
        return {
          Fragment: Symbol("Fragment"),
          jsx: createElement,
          jsxs: createElement,
        };
      }
      if (name === "next/navigation") {
        return {
          notFound() {
            throw new Error("NOT_FOUND");
          },
          redirect(path) {
            throw new Error(`REDIRECT:${path}`);
          },
        };
      }
      if (name === "@/lib/auth/profile") {
        return {
          async getAuthenticatedProfile() {
            return { id: "requester-id", role };
          },
        };
      }
      if (name === "@/lib/supabase/server") {
        return {
          async createClient() {
            query.clientCreated = true;
            return {
              from(table) {
                assert.equal(table, "shifts");
                return queryBuilder;
              },
            };
          },
        };
      }
      if (name === "./create-shift-form") {
        return { CreateShiftForm };
      }
      throw new Error(`Unexpected import: ${name}`);
    },
  }, { filename });

  return { page: exports.default, CreateShiftForm, query };
}

test("duplicate prefill copies only reusable shift fields and requirements", async () => {
  const originalShift = {
    event_name: "Campus Forum",
    start_time: "09:00:00",
    end_time: "15:00:00",
    location: "Annex 1",
    notes: "Bring radios.",
    shift_requirements: [
      { role: "Technician", staff_needed: 2 },
      { role: "Venue Manager", staff_needed: 1 },
    ],
  };
  const originalSnapshot = JSON.stringify(originalShift);
  const context = loadNewShiftPage({ shift: originalShift });
  const result = await context.page({
    searchParams: Promise.resolve({ duplicate: shiftId }),
  });
  const form = findElement(result, context.CreateShiftForm);

  assert.ok(form);
  assert.equal(context.query.id, shiftId);
  assert.equal(form.props.initialValues.eventName, "Campus Forum");
  assert.equal(form.props.initialValues.startTime, "09:00:00");
  assert.equal(form.props.initialValues.endTime, "15:00:00");
  assert.equal(form.props.initialValues.location, "Annex 1");
  assert.equal(form.props.initialValues.notes, "Bring radios.");
  assert.equal(form.props.initialValues.date, "");
  assert.equal(form.props.initialValues.responseDeadline, "");
  assert.equal(
    JSON.stringify(form.props.initialValues.requirements),
    JSON.stringify([
      { id: "duplicate-requirement-0", role: "Technician", count: 2 },
      { id: "duplicate-requirement-1", role: "Venue Manager", count: 1 },
    ]),
  );
  assert.equal(form.props.cancelHref, `/admin/shifts/${shiftId}`);
  assert.equal(JSON.stringify(originalShift), originalSnapshot);
  assert.doesNotMatch(
    context.query.selected,
    /availability|assignment|response_deadline|created_by|created_at|updated_at/i,
  );
});

test("duplicate loading is admin-only", async () => {
  const context = loadNewShiftPage({ role: "staff" });

  await assert.rejects(
    context.page({
      searchParams: Promise.resolve({ duplicate: shiftId }),
    }),
    { message: "REDIRECT:/dashboard" },
  );
  assert.equal(context.query.clientCreated, false);
});

test("invalid and missing duplicate shift IDs return not found", async () => {
  const invalidContext = loadNewShiftPage();
  await assert.rejects(
    invalidContext.page({
      searchParams: Promise.resolve({ duplicate: "not-a-uuid" }),
    }),
    { message: "NOT_FOUND" },
  );
  assert.equal(invalidContext.query.clientCreated, false);

  const missingContext = loadNewShiftPage({ shift: null });
  await assert.rejects(
    missingContext.page({
      searchParams: Promise.resolve({ duplicate: shiftId }),
    }),
    { message: "NOT_FOUND" },
  );
});

test("ordinary Create Shift keeps its existing date-prefill flow", async () => {
  const context = loadNewShiftPage();
  const result = await context.page({
    searchParams: Promise.resolve({ date: "2026-11-12" }),
  });
  const form = findElement(result, context.CreateShiftForm);

  assert.ok(form);
  assert.equal(form.props.initialDate, "2026-11-12");
  assert.equal(form.props.initialValues, undefined);
  assert.equal(context.query.clientCreated, false);
});

test("shift details exposes duplication through the existing Create Shift route", () => {
  const detailPage = readFileSync(
    resolve(root, "app/admin/shifts/[id]/page.tsx"),
    "utf8",
  );
  const createForm = readFileSync(
    resolve(root, "app/admin/shifts/new/create-shift-form.tsx"),
    "utf8",
  );

  assert.match(detailPage, />\s*Duplicate\s*</);
  assert.match(detailPage, /\/admin\/shifts\/new\?duplicate=\$\{shift\.id\}/);
  assert.match(createForm, /action=\{createShift\}/);
  assert.match(createForm, /mode="create"/);
});
