import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

const filename = resolve(process.cwd(), "lib/date.ts");
const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const dateHelpers = {};

runInNewContext(compiled, {
  exports: dateHelpers,
  Intl,
  Date,
  Map,
});

test("application dates stay on the Los Angeles day near UTC midnight", () => {
  assert.equal(
    dateHelpers.getAppDateKey(new Date("2026-10-15T01:00:00Z")),
    "2026-10-14",
  );
});

test("application dates respect daylight-saving boundaries", () => {
  assert.equal(
    dateHelpers.getAppDateKey(new Date("2026-07-15T06:59:59Z")),
    "2026-07-14",
  );
  assert.equal(
    dateHelpers.getAppDateKey(new Date("2026-07-15T07:00:00Z")),
    "2026-07-15",
  );
  assert.equal(
    dateHelpers.getAppDateKey(new Date("2026-01-15T07:59:59Z")),
    "2026-01-14",
  );
  assert.equal(
    dateHelpers.getAppDateKey(new Date("2026-01-15T08:00:00Z")),
    "2026-01-15",
  );
});

test("datetime inputs show the deadline in Pacific time on any server", () => {
  assert.equal(dateHelpers.toAppDateTimeInput("2026-11-04T01:00:00Z"), "2026-11-03T17:00");
  assert.equal(dateHelpers.toAppDateTimeInput("2026-07-15T19:30:00Z"), "2026-07-15T12:30");
  assert.equal(dateHelpers.toAppDateTimeInput("2026-11-04T08:00:00Z"), "2026-11-04T00:00");
});
