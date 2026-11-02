import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

const root = process.cwd();

function compile(relativePath, jsx = false) {
  const filename = resolve(root, relativePath);
  const outputText = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      ...(jsx ? { jsx: ts.JsxEmit.ReactJSX } : {}),
    },
  }).outputText;

  return { filename, outputText };
}

function loadCoverage() {
  const { filename, outputText } = compile("lib/shifts/coverage.ts");
  const exports = {};
  runInNewContext(outputText, { exports }, { filename });
  return exports;
}

const coverage = loadCoverage();

// Values created inside the VM have different prototypes; compare as plain data.
function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function assignments(...roles) {
  return roles.map((role) => ({ assigned_role: role }));
}

test("a shift is fully staffed when every role has enough assignments", () => {
  const result = coverage.calculateShiftCoverage(
    [
      { role: "Technician", staff_needed: 2 },
      { role: "Event Assistant", staff_needed: 1 },
    ],
    assignments("Technician", "Technician", "Event Assistant"),
  );

  assert.equal(result.status, "fully_staffed");
  assert.equal(result.required, 3);
  assert.equal(result.filled, 3);
  assert.equal(result.open, 0);
  assert.equal(coverage.getCoverageLabel(result), "Fully staffed · 3 / 3");
  assert.equal(coverage.getCoverageTone(result), "emerald");
});

test("a partially staffed shift reports filled and open slots across roles", () => {
  const result = coverage.calculateShiftCoverage(
    [
      { role: "Technician", staff_needed: 2 },
      { role: "Event Assistant", staff_needed: 3 },
    ],
    assignments("Technician", "Technician", "Event Assistant"),
  );

  assert.equal(result.status, "partially_staffed");
  assert.equal(result.required, 5);
  assert.equal(result.filled, 3);
  assert.equal(result.open, 2);
  assert.deepEqual(plain(result.roles), [
    { role: "Technician", needed: 2, filled: 2, open: 0 },
    { role: "Event Assistant", needed: 3, filled: 1, open: 2 },
  ]);
  assert.equal(coverage.getCoverageLabel(result), "3 / 5 staffed · 2 open slots");
  assert.equal(coverage.getCoverageTone(result), "amber");
});

test("a shift with no assignments is unstaffed and shown in a neutral tone", () => {
  const result = coverage.calculateShiftCoverage(
    [{ role: "Technician", staff_needed: 1 }],
    [],
  );

  assert.equal(result.status, "unstaffed");
  assert.equal(result.open, 1);
  assert.equal(coverage.getCoverageLabel(result), "0 / 1 staffed · 1 open slot");
  assert.equal(coverage.getCoverageTone(result), "slate");
});

test("missing assignment data is treated as no assignments", () => {
  const result = coverage.calculateShiftCoverage(
    [{ role: "Technician", staff_needed: 2 }],
    null,
  );

  assert.equal(result.status, "unstaffed");
  assert.equal(result.open, 2);
});

test("an assignment in the wrong role does not fill another role", () => {
  const result = coverage.calculateShiftCoverage(
    [
      { role: "Technician", staff_needed: 1 },
      { role: "Event Assistant", staff_needed: 1 },
    ],
    assignments("Technician", "Technician", "Usher"),
  );

  assert.equal(result.status, "partially_staffed");
  assert.equal(result.filled, 1);
  assert.equal(result.open, 1);
  assert.deepEqual(plain(result.roles[1]), {
    role: "Event Assistant",
    needed: 1,
    filled: 0,
    open: 1,
  });
});

test("role names match exactly, the same as the assignment action", () => {
  const result = coverage.calculateShiftCoverage(
    [{ role: "Technician", staff_needed: 1 }],
    assignments("technician"),
  );

  assert.equal(result.filled, 0);
  assert.equal(result.open, 1);
});

test("availability responses never count as assignments", () => {
  const responses = [
    { user_id: "a", response: "yes" },
    { user_id: "b", response: "maybe" },
  ];
  // Response rows carry no assigned_role, so they can never fill a slot.
  const result = coverage.calculateShiftCoverage(
    [{ role: "Technician", staff_needed: 2 }],
    responses,
  );

  assert.equal(result.filled, 0);
  assert.equal(result.open, 2);
  assert.equal(result.status, "unstaffed");
});

test("a shift without requirements is not reported as staffed or needing staff", () => {
  for (const requirements of [[], null, undefined]) {
    const result = coverage.calculateShiftCoverage(
      requirements,
      assignments("Technician"),
    );

    assert.equal(result.status, "no_requirements");
    assert.equal(result.required, 0);
    assert.equal(result.open, 0);
    assert.equal(coverage.getCoverageLabel(result), "No staffing set");
    assert.equal(coverage.getCoverageTone(result), "slate");
  }

  const summary = coverage.summarizeCoverage([
    coverage.calculateShiftCoverage([], []),
  ]);

  assert.deepEqual(plain(summary), {
    shiftCount: 1,
    fullyStaffed: 0,
    needsStaff: 0,
    noRequirements: 1,
    openSlots: 0,
  });
});

test("the summary totals open slots accurately across shifts", () => {
  const shifts = [
    coverage.calculateShiftCoverage(
      [{ role: "Technician", staff_needed: 2 }],
      assignments("Technician", "Technician"),
    ),
    coverage.calculateShiftCoverage(
      [
        { role: "Technician", staff_needed: 2 },
        { role: "Event Assistant", staff_needed: 3 },
      ],
      assignments("Technician", "Event Assistant"),
    ),
    coverage.calculateShiftCoverage(
      [{ role: "Usher", staff_needed: 4 }],
      [],
    ),
    coverage.calculateShiftCoverage([], []),
  ];

  assert.deepEqual(plain(coverage.summarizeCoverage(shifts)), {
    shiftCount: 4,
    fullyStaffed: 1,
    needsStaff: 2,
    noRequirements: 1,
    openSlots: 7,
  });
  assert.deepEqual(plain(coverage.summarizeCoverage([])), {
    shiftCount: 0,
    fullyStaffed: 0,
    needsStaff: 0,
    noRequirements: 0,
    openSlots: 0,
  });
});

// Page-level checks for /admin/shifts.

function createElement(type, props) {
  return { type, props: props ?? {} };
}

function findAll(node, type, matches = []) {
  if (!node || typeof node !== "object") {
    return matches;
  }

  if (Array.isArray(node)) {
    for (const child of node) findAll(child, type, matches);
    return matches;
  }

  if (node.type === type) {
    matches.push(node);
  }

  findAll(node.props?.children, type, matches);
  return matches;
}

function collectText(node) {
  if (node === null || node === undefined || typeof node === "boolean") {
    return "";
  }

  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(collectText).join("");
  }

  return collectText(node.props?.children);
}

function loadAdminShiftsPage({ role = "admin", shifts = [], todayKey = "2026-11-02" } = {}) {
  const { filename, outputText } = compile("app/admin/shifts/page.tsx", true);
  const exports = {};
  const query = { tables: [], selected: null, adminClientUsed: false };
  const MetricCard = function MetricCard() {};
  const StatusBadge = function StatusBadge() {};
  const queryBuilder = {
    select(columns) {
      query.selected = columns;
      return queryBuilder;
    },
    order() {
      return queryBuilder;
    },
    then(resolveResult) {
      resolveResult({ data: shifts, error: null });
    },
  };

  runInNewContext(outputText, {
    exports,
    Date,
    Intl,
    Number,
    Array,
    Map,
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
          redirect(path) {
            throw new Error(`REDIRECT:${path}`);
          },
        };
      }
      if (name === "next/link") {
        return { default: function Link() {} };
      }
      if (name === "@/components/ui/app-icon") {
        return { AppIcon: function AppIcon() {} };
      }
      if (name === "@/components/ui/metric-card") {
        return { MetricCard };
      }
      if (name === "@/components/ui/status-badge") {
        return { StatusBadge };
      }
      if (name === "@/lib/auth/profile") {
        return {
          async getAuthenticatedProfile() {
            return { id: "admin-id", role };
          },
        };
      }
      if (name === "@/lib/date") {
        return { getAppDateKey: () => todayKey };
      }
      if (name === "@/lib/shifts/coverage") {
        return coverage;
      }
      if (name === "@/lib/supabase/server") {
        return {
          async createClient() {
            return {
              from(table) {
                query.tables.push(table);
                return queryBuilder;
              },
            };
          },
        };
      }
      if (name === "@/lib/supabase/admin") {
        query.adminClientUsed = true;
      }
      throw new Error(`Unexpected import: ${name}`);
    },
  }, { filename });

  return { page: exports.default, MetricCard, StatusBadge, query };
}

function shiftRow(id, date, requirements, assignedRoles) {
  return {
    id,
    event_name: `Event ${id}`,
    date,
    start_time: "09:00:00",
    end_time: "15:00:00",
    location: null,
    shift_requirements: requirements,
    assignments: assignments(...assignedRoles),
  };
}

test("admin shifts page loads coverage in one query without staff details", async () => {
  const context = loadAdminShiftsPage();
  await context.page({ searchParams: Promise.resolve({}) });

  assert.deepEqual(context.query.tables, ["shifts"]);
  assert.match(context.query.selected, /assignments\s*\(\s*assigned_role\s*\)/);
  assert.doesNotMatch(context.query.selected, /availability_responses|profiles|user_id/);
  assert.equal(context.query.adminClientUsed, false);
});

test("admin shifts page summarizes upcoming coverage and badges only upcoming shifts", async () => {
  const context = loadAdminShiftsPage({
    todayKey: "2026-11-02",
    shifts: [
      shiftRow("past", "2026-11-01", [{ role: "Technician", staff_needed: 2 }], []),
      shiftRow("today", "2026-11-02", [{ role: "Technician", staff_needed: 2 }], ["Technician", "Technician"]),
      shiftRow(
        "partial",
        "2026-11-05",
        [
          { role: "Technician", staff_needed: 2 },
          { role: "Event Assistant", staff_needed: 3 },
        ],
        ["Technician", "Technician", "Event Assistant"],
      ),
      shiftRow("empty", "2026-11-06", [{ role: "Usher", staff_needed: 1 }], []),
      shiftRow("none", "2026-11-07", [], []),
    ],
  });
  const result = await context.page({ searchParams: Promise.resolve({}) });

  const metrics = Object.fromEntries(
    findAll(result, context.MetricCard).map((card) => [
      card.props.label,
      card.props.value,
    ]),
  );
  assert.deepEqual(metrics, {
    "Upcoming shifts": 4,
    "Fully staffed": 1,
    "Needs staff": 2,
    "Open slots": 3,
  });

  const badges = findAll(result, context.StatusBadge).map((badge) => ({
    tone: badge.props.tone,
    text: collectText(badge.props.children),
  }));
  assert.deepEqual(badges, [
    { tone: "emerald", text: "Fully staffed · 2 / 2" },
    { tone: "amber", text: "3 / 5 staffed · 2 open slots" },
    { tone: "slate", text: "0 / 1 staffed · 1 open slot" },
    { tone: "slate", text: "No staffing set" },
  ]);

  const text = collectText(result);
  assert.match(text, /All shifts from Mon, Nov 2, 2026 onward \(Pacific time\)/);
  assert.match(text, /1 upcoming shift has no staffing requirements/);
});

test("admin shifts page still redirects staff members", async () => {
  const context = loadAdminShiftsPage({ role: "staff" });

  await assert.rejects(
    context.page({ searchParams: Promise.resolve({}) }),
    /REDIRECT:\/dashboard/,
  );
  assert.deepEqual(context.query.tables, []);
});
