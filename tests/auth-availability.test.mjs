import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

const root = process.cwd();
const shiftId = "11111111-1111-4111-8111-111111111111";
const profileId = "22222222-2222-4222-8222-222222222222";

function loadLoginEmailHelper() {
  const filename = resolve(root, "lib/auth/login-email.ts");
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

const loginEmailHelper = loadLoginEmailHelper();

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
    Set,
    require(name) {
      if (name in mocks) return mocks[name];
      if (name === "@/lib/auth/login-email") return loginEmailHelper;
      throw new Error(`Unexpected import: ${name}`);
    },
  }, { filename });

  return exports;
}

function loginForm(username, password) {
  const formData = new FormData();
  formData.set("username", username);
  formData.set("password", password);
  return formData;
}

function availabilityForm(response, overrides = {}) {
  const formData = new FormData();
  const values = {
    shiftId,
    response,
    suggestedStartTime: "09:00",
    suggestedEndTime: "13:00",
    note: " Can cover the morning. ",
    ...overrides,
  };

  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value);
  }

  return formData;
}

test("login normalizes usernames and only sends the synthetic email to Supabase", async () => {
  let credentials;
  const { login } = loadModule("app/login/actions.ts", {
    "next/cache": { revalidatePath() {} },
    "next/navigation": {
      redirect(path) {
        throw new Error(`REDIRECT:${path}`);
      },
    },
    "@/lib/supabase/server": {
      async createClient() {
        return {
          auth: {
            async signInWithPassword(value) {
              credentials = value;
              return { error: null };
            },
          },
        };
      },
    },
  });

  await assert.rejects(
    login({}, loginForm("  Staff.User  ", "private-password")),
    { message: "REDIRECT:/dashboard" },
  );
  assert.equal(credentials.email, "staff.user@schedule.local");
  assert.equal(credentials.password, "private-password");
});

test("login rejects invalid usernames before contacting Supabase", async () => {
  let clientCreated = false;
  const { login } = loadModule("app/login/actions.ts", {
    "next/cache": { revalidatePath() {} },
    "next/navigation": { redirect() {} },
    "@/lib/supabase/server": {
      async createClient() {
        clientCreated = true;
      },
    },
  });

  const result = await login({}, loginForm("not valid", "password"));
  assert.match(result.error, /only contain/);
  assert.equal(clientCreated, false);
});

test("login keeps authentication failures generic", async () => {
  const { login } = loadModule("app/login/actions.ts", {
    "next/cache": { revalidatePath() {} },
    "next/navigation": { redirect() {} },
    "@/lib/supabase/server": {
      async createClient() {
        return {
          auth: {
            async signInWithPassword() {
              return { error: { message: "sensitive provider detail" } };
            },
          },
        };
      },
    },
  });

  const result = await login({}, loginForm("staff", "wrong-password"));
  assert.equal(result.error, "Invalid username or password.");
});

function setupAvailability({ deadline = "2099-01-01T00:00:00Z" } = {}) {
  const writes = [];
  const refreshed = [];
  const client = {
    from(table) {
      if (table === "shifts") {
        const query = {
          select() { return query; },
          eq() { return query; },
          async maybeSingle() {
            return {
              data: { id: shiftId, response_deadline: deadline },
              error: null,
            };
          },
        };
        return query;
      }

      if (table === "availability_responses") {
        return {
          async upsert(value, options) {
            writes.push({ value, options });
            return { error: null };
          },
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  };
  const actions = loadModule("app/shifts/actions.ts", {
    "next/cache": {
      revalidatePath(path) {
        refreshed.push(path);
      },
    },
    "@/lib/auth/profile": {
      async getAuthenticatedProfile() {
        return { id: profileId, role: "staff" };
      },
    },
    "@/lib/supabase/server": {
      async createClient() {
        return client;
      },
    },
  });

  return { ...actions, writes, refreshed };
}

test("availability writes always use the authenticated profile and clear non-Maybe times", async () => {
  const context = setupAvailability();
  const formData = availabilityForm("yes", { userId: "attacker-controlled" });
  const result = await context.saveAvailability({}, formData);

  assert.equal(result.status, "success");
  assert.equal(result.message, "Availability saved.");
  assert.equal(context.writes.length, 1);
  assert.equal(context.writes[0].value.user_id, profileId);
  assert.equal(context.writes[0].value.suggested_start_time, null);
  assert.equal(context.writes[0].value.suggested_end_time, null);
  assert.equal(context.writes[0].value.note, "Can cover the morning.");
  assert.equal(context.writes[0].options.onConflict, "shift_id,user_id");
});

test("availability validates Maybe time ranges before writing", async () => {
  const context = setupAvailability();
  const result = await context.saveAvailability(
    {},
    availabilityForm("maybe", {
      suggestedStartTime: "13:00",
      suggestedEndTime: "09:00",
    }),
  );

  assert.match(result.message, /later than/);
  assert.equal(context.writes.length, 0);
});

test("availability rejects expired deadlines before writing", async () => {
  const context = setupAvailability({ deadline: "2020-01-01T00:00:00Z" });
  const result = await context.saveAvailability(
    {},
    availabilityForm("maybe"),
  );

  assert.match(result.message, /deadline.*passed/i);
  assert.equal(context.writes.length, 0);
  assert.ok(context.refreshed.includes("/shifts"));
});

test("admin mutation actions reject staff before privileged work", async () => {
  let normalClientCreated = false;
  let adminClientCreated = false;
  const redirect = (path) => {
    throw new Error(`REDIRECT:${path}`);
  };
  const profileMock = {
    async getAuthenticatedProfile() {
      return { id: profileId, role: "staff" };
    },
  };
  const serverClientMock = {
    async createClient() {
      normalClientCreated = true;
      throw new Error("Database access should not occur.");
    },
  };

  const shiftActions = loadModule("app/admin/shifts/actions.ts", {
    "next/cache": { revalidatePath() {} },
    "next/navigation": { redirect },
    "@/lib/auth/profile": profileMock,
    "@/lib/supabase/server": serverClientMock,
    "@/lib/shifts/validation": { parseShiftForm() { throw new Error("Unexpected validation."); } },
  });
  const assignmentActions = loadModule("app/admin/shifts/[id]/actions.ts", {
    "next/cache": { revalidatePath() {} },
    "next/navigation": { redirect },
    "@/lib/auth/profile": profileMock,
    "@/lib/supabase/server": serverClientMock,
  });
  const staffActions = loadModule("app/admin/staff/actions.ts", {
    "server-only": {},
    "next/cache": { revalidatePath() {} },
    "next/navigation": { redirect },
    "@/lib/auth/profile": profileMock,
    "@/lib/supabase/server": serverClientMock,
    "@/lib/supabase/admin": {
      createAdminClient() {
        adminClientCreated = true;
        throw new Error("Privileged access should not occur.");
      },
    },
  });

  const calls = [
    () => shiftActions.createShift({}, new FormData()),
    () => assignmentActions.assignStaff({}, new FormData()),
    () => assignmentActions.removeAssignment({}, new FormData()),
    () => staffActions.createStaffAccount({}, new FormData()),
    () => staffActions.resetStaffPassword(profileId, {}, new FormData()),
  ];

  for (const call of calls) {
    await assert.rejects(call(), { message: "REDIRECT:/dashboard" });
  }

  assert.equal(normalClientCreated, false);
  assert.equal(adminClientCreated, false);
});
