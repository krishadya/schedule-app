import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

const root = process.cwd();
const profileId = "22222222-2222-4222-8222-222222222222";

function loadActions(mocks) {
  const filename = resolve(root, "app/account/actions.ts");
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
    File,
    Date,
    require(name) {
      if (name === "server-only") return {};
      if (name in mocks) return mocks[name];
      throw new Error(`Unexpected import: ${name}`);
    },
  }, { filename });

  return exports;
}

function profileForm(fullName, username) {
  const formData = new FormData();
  formData.set("fullName", fullName);
  formData.set("username", username);
  return formData;
}

function profile() {
  return {
    id: profileId,
    full_name: "Old Name",
    username: "old.user",
    role: "staff",
    avatar_path: null,
    avatar_url: null,
  };
}

test("profile updates normalize the username and synchronize the internal Auth email", async () => {
  const writes = [];
  const authUpdates = [];
  const revalidated = [];
  const client = {
    from(table) {
      assert.equal(table, "profiles");
      return {
        update(value) {
          return {
            async eq(column, valueId) {
              writes.push({ value, column, valueId });
              return { error: null };
            },
          };
        },
      };
    },
  };
  const { updateProfile } = loadActions({
    "next/cache": {
      revalidatePath(...args) {
        revalidated.push(args);
      },
    },
    "@/lib/auth/profile": { async getAuthenticatedProfile() { return profile(); } },
    "@/lib/supabase/server": { async createClient() { return client; } },
    "@/lib/supabase/admin": {
      createAdminClient() {
        return {
          auth: {
            admin: {
              async updateUserById(id, attributes) {
                authUpdates.push({ id, attributes });
                return { error: null };
              },
            },
          },
        };
      },
    },
  });

  const result = await updateProfile({}, profileForm(" New Name ", " NEW.USER "));

  assert.equal(result.status, "success");
  assert.equal(writes.length, 1);
  assert.equal(writes[0].value.full_name, "New Name");
  assert.equal(writes[0].value.username, "new.user");
  assert.equal(writes[0].column, "id");
  assert.equal(writes[0].valueId, profileId);
  assert.equal(authUpdates.length, 1);
  assert.equal(authUpdates[0].id, profileId);
  assert.equal(authUpdates[0].attributes.email, "new.user@vernon.local");
  assert.ok(revalidated.some(([path, type]) => path === "/" && type === "layout"));
});

test("profile updates reject invalid usernames before writing", async () => {
  let clientCreated = false;
  const { updateProfile } = loadActions({
    "next/cache": { revalidatePath() {} },
    "@/lib/auth/profile": { async getAuthenticatedProfile() { return profile(); } },
    "@/lib/supabase/server": {
      async createClient() {
        clientCreated = true;
      },
    },
    "@/lib/supabase/admin": { createAdminClient() {} },
  });

  const result = await updateProfile({}, profileForm("New Name", "not valid"));

  assert.equal(result.status, "error");
  assert.match(result.message, /only contain/);
  assert.equal(clientCreated, false);
});

