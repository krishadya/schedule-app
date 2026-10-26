import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

const root = process.cwd();

function loadModule(relativePath, mocks = {}) {
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
    FormData,
    Date,
    Number,
    JSON,
    Set,
    require(name) {
      if (name in mocks) return mocks[name];
      throw new Error(`Unexpected import: ${name}`);
    },
  }, { filename });

  return exports;
}

function loadRecurrence() {
  const validation = loadModule("lib/shifts/validation.ts");

  return loadModule("lib/shifts/recurrence.ts", {
    "./validation": validation,
  });
}

function recurringForm(overrides = {}) {
  const formData = new FormData();
  const values = {
    eventName: "Table Squad",
    startDate: "2026-11-02",
    endDate: "2026-11-27",
    selectedDays: JSON.stringify([
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
    ]),
    startTime: "09:00",
    endTime: "17:00",
    location: "Hall A",
    notes: "Bring setup tools.",
    responseDeadline: "2026-11-01T01:00:00.000Z",
    requirements: JSON.stringify([
      { role: "Technician", count: "2" },
      { role: "Venue Manager", count: "1" },
    ]),
    ...overrides,
  };

  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value);
  }

  return formData;
}

function setupAction({ rpcResult = { data: 20, error: null } } = {}) {
  const rpcCalls = [];
  const revalidated = [];
  const recurrence = loadRecurrence();
  const deadline = loadModule("lib/shifts/deadline.ts");
  const actions = loadModule("app/admin/shifts/recurring/actions.ts", {
    "next/cache": {
      revalidatePath(path) {
        revalidated.push(path);
      },
    },
    "next/navigation": {
      redirect(path) {
        throw new Error(`REDIRECT:${path}`);
      },
    },
    "@/lib/auth/profile": {
      async getAuthenticatedProfile() {
        return { id: "admin-id", role: "admin" };
      },
    },
    "@/lib/shifts/deadline": deadline,
    "@/lib/shifts/recurrence": recurrence,
    "@/lib/supabase/server": {
      async createClient() {
        return {
          async rpc(name, args) {
            rpcCalls.push({ name, args });

            if (rpcResult instanceof Error) {
              throw rpcResult;
            }

            return rpcResult;
          },
        };
      },
    },
  });

  return { ...actions, rpcCalls, revalidated };
}

test("recurring save independently rejects a non-admin before database work", async () => {
  let clientCreated = false;
  const actions = loadModule("app/admin/shifts/recurring/actions.ts", {
    "next/cache": { revalidatePath() {} },
    "next/navigation": {
      redirect(path) {
        throw new Error(`REDIRECT:${path}`);
      },
    },
    "@/lib/auth/profile": {
      async getAuthenticatedProfile() {
        return { id: "staff-id", role: "staff" };
      },
    },
    "@/lib/shifts/deadline": { isExplicitTimestamp() { return true; } },
    "@/lib/shifts/recurrence": {
      generateRecurringDates() {
        throw new Error("Recurrence generation should not run.");
      },
      validateRecurringShiftDraft() {
        throw new Error("Validation should not run.");
      },
    },
    "@/lib/supabase/server": {
      async createClient() {
        clientCreated = true;
      },
    },
  });

  await assert.rejects(
    actions.createRecurringShifts(
      { status: "idle", message: null, count: null },
      recurringForm(),
    ),
    { message: "REDIRECT:/dashboard" },
  );
  assert.equal(clientCreated, false);
});

test("recurring save regenerates and validates dates on the server", async () => {
  const context = setupAction();
  const result = await context.createRecurringShifts(
    { status: "idle", message: null, count: null },
    recurringForm({ endDate: "2026-11-01" }),
  );

  assert.equal(result.status, "error");
  assert.match(result.message, /before the start date/i);
  assert.equal(context.rpcCalls.length, 0);
});

test("recurring save maps validated values to the RPC exactly", async () => {
  const context = setupAction();
  const result = await context.createRecurringShifts(
    { status: "idle", message: null, count: null },
    recurringForm(),
  );

  assert.equal(result.status, "success");
  assert.equal(result.count, 20);
  assert.equal(context.rpcCalls.length, 1);
  assert.equal(context.rpcCalls[0].name, "create_recurring_shifts");

  const args = context.rpcCalls[0].args;
  assert.equal(args.p_event_name, "Table Squad");
  assert.equal(args.p_occurrence_dates.length, 20);
  assert.equal(args.p_occurrence_dates[0], "2026-11-02");
  assert.equal(args.p_occurrence_dates.at(-1), "2026-11-27");
  assert.equal(args.p_start_time, "09:00");
  assert.equal(args.p_end_time, "17:00");
  assert.equal(args.p_location, "Hall A");
  assert.equal(args.p_notes, "Bring setup tools.");
  assert.equal(args.p_response_deadline, "2026-11-01T01:00:00.000Z");
  assert.equal(JSON.stringify(args.p_requirements), JSON.stringify([
    { role: "Technician", staff_needed: 2 },
    { role: "Venue Manager", staff_needed: 1 },
  ]));
  assert.ok(context.revalidated.includes("/admin/shifts"));
  assert.ok(context.revalidated.includes("/dashboard"));
});

test("datetime-local deadlines use the browser local timezone conversion", () => {
  const originalTimezone = process.env.TZ;

  try {
    process.env.TZ = "America/Los_Angeles";
    const deadline = loadModule("lib/shifts/deadline.ts");

    assert.equal(
      deadline.localDateTimeToIso("2026-11-02T17:00"),
      "2026-11-03T01:00:00.000Z",
    );
    assert.equal(
      deadline.localDateTimeToIso("2026-07-15T17:00"),
      "2026-07-16T00:00:00.000Z",
    );
  } finally {
    process.env.TZ = originalTimezone;
  }
});

test("RPC failures stay readable and never claim success", async () => {
  const context = setupAction({
    rpcResult: {
      data: null,
      error: { code: "22023", message: "sensitive database detail" },
    },
  });
  const result = await context.createRecurringShifts(
    { status: "idle", message: null, count: null },
    recurringForm(),
  );

  assert.equal(result.status, "error");
  assert.match(result.message, /rejected/i);
  assert.doesNotMatch(result.message, /sensitive database detail/i);
});

test("ambiguous network and count responses require checking the shift list", async () => {
  const networkContext = setupAction({ rpcResult: new Error("network lost") });
  const networkResult = await networkContext.createRecurringShifts(
    { status: "idle", message: null, count: null },
    recurringForm(),
  );
  assert.equal(networkResult.status, "error");
  assert.match(networkResult.message, /check the shift list before retrying/i);

  const mismatchContext = setupAction({
    rpcResult: { data: 19, error: null },
  });
  const mismatchResult = await mismatchContext.createRecurringShifts(
    { status: "idle", message: null, count: null },
    recurringForm(),
  );
  assert.equal(mismatchResult.status, "error");
  assert.match(mismatchResult.message, /check the shift list before retrying/i);
});
