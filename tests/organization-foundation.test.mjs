import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20261026151044_organization_foundation.sql",
);
const migration = readFileSync(migrationPath, "utf8");

test("organization foundation creates only the two empty tenant tables", () => {
  const createdTables = [
    ...migration.matchAll(/create\s+table\s+public\.([a-z_]+)/gi),
  ].map((match) => match[1]);

  assert.deepEqual(createdTables, ["organizations", "organization_memberships"]);
  assert.doesNotMatch(migration, /insert\s+into\s+public\.(organizations|organization_memberships)/i);
});

test("organization foundation is deny-by-default for application roles", () => {
  assert.match(
    migration,
    /alter\s+table\s+public\.organizations\s+enable\s+row\s+level\s+security/i,
  );
  assert.match(
    migration,
    /alter\s+table\s+public\.organization_memberships\s+enable\s+row\s+level\s+security/i,
  );
  assert.match(
    migration,
    /revoke\s+all\s+privileges[\s\S]*from\s+public,\s*anon,\s*authenticated/i,
  );
  assert.doesNotMatch(migration, /create\s+policy/i);
  assert.doesNotMatch(migration, /grant\s+/i);
});

test("organization foundation preserves history and validates tenant records", () => {
  assert.match(
    migration,
    /organizations_created_by_fkey[\s\S]*references\s+public\.profiles\s*\(id\)[\s\S]*on\s+delete\s+restrict/i,
  );
  assert.match(
    migration,
    /organization_memberships_organization_id_fkey[\s\S]*references\s+public\.organizations\s*\(id\)[\s\S]*on\s+delete\s+restrict/i,
  );
  assert.match(
    migration,
    /organization_memberships_user_id_fkey[\s\S]*references\s+public\.profiles\s*\(id\)[\s\S]*on\s+delete\s+restrict/i,
  );
  assert.match(migration, /role\s+in\s*\('owner',\s*'admin',\s*'manager',\s*'staff'\)/i);
  assert.match(migration, /jsonb_typeof\(settings\)\s*=\s*'object'/i);
  assert.match(migration, /slug\s*~\s*'\^\[a-z0-9\]\+\(-\[a-z0-9\]\+\)\*\$'/i);
});
