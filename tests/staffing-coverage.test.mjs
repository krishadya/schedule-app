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

function loadAdminShiftsPage({
  role = "admin",
  upcoming = [],
  past = [],
  pastCount = past.length,
  todayKey = "2026-11-02",
} = {}) {
  const { filename, outputText } = compile("app/admin/shifts/page.tsx", true);
  const exports = {};
  const queries = [];
  const MetricCard = function MetricCard() {};
  const StatusBadge = function StatusBadge() {};

  function createQuery(table) {
    const query = { table, filters: [], orders: [], limit: null, head: false };
    queries.push(query);
    const builder = {
      select(columns, options) {
        query.selected = columns;
        query.head = Boolean(options?.head);
        return builder;
      },
      gte(column, value) {
        query.filters.push(["gte", column, value]);
        return builder;
      },
      lt(column, value) {
        query.filters.push(["lt", column, value]);
        return builder;
      },
      order(column, options) {
        query.orders.push([column, options.ascending]);
        return builder;
      },
      limit(value) {
        query.limit = value;
        return builder;
      },
      then(resolveResult) {
        if (query.head) {
          resolveResult({ data: null, count: pastCount, error: null });
        } else if (query.filters.some(([op]) => op === "lt")) {
          resolveResult({ data: past, error: null });
        } else {
          resolveResult({ data: upcoming, error: null });
        }
      },
    };
    return builder;
  }

  runInNewContext(outputText, {
    exports,
    Date,
    Intl,
    Number,
    Array,
    Map,
    Promise,
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
            return { from: createQuery };
          },
        };
      }
      throw new Error(`Unexpected import: ${name}`);
    },
  }, { filename });

  return { page: exports.default, MetricCard, StatusBadge, queries };
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

const upcomingRows = [
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
];

function render(context, searchParams = {}) {
  return context.page({ searchParams: Promise.resolve(searchParams) });
}

function badgesOf(context, result) {
  return findAll(result, context.StatusBadge).map((badge) => ({
    tone: badge.props.tone,
    text: collectText(badge.props.children),
  }));
}

function shiftTitles(result) {
  return findAll(result, "article").map((article) =>
    collectText(findAll(article, "h2")[0]),
  );
}

test("admin shifts page only queries shifts, without staff details", async () => {
  const context = loadAdminShiftsPage({ upcoming: upcomingRows });
  await render(context);

  assert.ok(context.queries.length > 0);
  for (const query of context.queries) {
    assert.equal(query.table, "shifts");
    assert.doesNotMatch(query.selected, /availability_responses|profiles|user_id/);
  }
  const listQuery = context.queries.find((query) => !query.head);
  assert.match(listQuery.selected, /assignments\s*\(\s*assigned_role\s*\)/);
  assert.deepEqual(plain(listQuery.filters), [["gte", "date", "2026-11-02"]]);
});

test("admin shifts page summarizes all upcoming coverage", async () => {
  const context = loadAdminShiftsPage({ upcoming: upcomingRows, pastCount: 3 });
  const result = await render(context);

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

  assert.deepEqual(badgesOf(context, result), [
    { tone: "emerald", text: "Fully staffed · 2 / 2" },
    { tone: "amber", text: "3 / 5 staffed · 2 open slots" },
    { tone: "slate", text: "0 / 1 staffed · 1 open slot" },
    { tone: "slate", text: "No staffing set" },
  ]);

  const text = collectText(result);
  assert.match(text, /All shifts from Mon, Nov 2, 2026 onward \(Pacific time\)/);
  assert.match(text, /1 upcoming shift has no staffing requirements/);
  assert.match(text, /Upcoming4/);
  assert.match(text, /Needs staff2/);
  assert.match(text, /Past3/);
  assert.match(text, /Event Assistant 1 \/ 3/);
});

test("needs-staff view lists only shifts with open slots", async () => {
  const context = loadAdminShiftsPage({ upcoming: upcomingRows });
  const result = await render(context, { view: "needs-staff" });

  assert.deepEqual(shiftTitles(result), ["Event partial", "Event empty"]);
  // The summary still covers every upcoming shift.
  const upcomingCard = findAll(result, context.MetricCard).find(
    (card) => card.props.label === "Upcoming shifts",
  );
  assert.equal(upcomingCard.props.value, 4);
});

test("past view loads recent past shifts newest first without coverage badges", async () => {
  const past = [
    shiftRow("yesterday", "2026-11-01", [{ role: "Technician", staff_needed: 2 }], ["Technician"]),
    shiftRow("last-week", "2026-10-26", [{ role: "Technician", staff_needed: 1 }], []),
  ];
  const context = loadAdminShiftsPage({ upcoming: upcomingRows, past, pastCount: 75 });
  const result = await render(context, { view: "past" });

  const pastQuery = context.queries.find(
    (query) => !query.head && query.filters.some(([op]) => op === "lt"),
  );
  assert.ok(pastQuery);
  assert.equal(pastQuery.limit, 50);
  assert.deepEqual(plain(pastQuery.orders), [
    ["date", false],
    ["start_time", false],
  ]);

  assert.deepEqual(shiftTitles(result), ["Event yesterday", "Event last-week"]);
  assert.deepEqual(badgesOf(context, result), []);
  assert.match(collectText(result), /Showing the 50 most recent of 75 past shifts/);
});

test("past shifts are not loaded unless the past view is open", async () => {
  const context = loadAdminShiftsPage({ upcoming: upcomingRows, pastCount: 5 });
  await render(context);

  const pastListQuery = context.queries.find(
    (query) => !query.head && query.filters.some(([op]) => op === "lt"),
  );
  assert.equal(pastListQuery, undefined);
});

test("unknown views fall back to upcoming", async () => {
  const context = loadAdminShiftsPage({ upcoming: upcomingRows });
  const result = await render(context, { view: "everything" });

  assert.equal(shiftTitles(result).length, 4);
});

test("admin shifts page still redirects staff members", async () => {
  const context = loadAdminShiftsPage({ role: "staff" });

  await assert.rejects(render(context), /REDIRECT:\/dashboard/);
  assert.deepEqual(context.queries, []);
});
