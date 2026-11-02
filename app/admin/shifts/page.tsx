import { redirect } from "next/navigation";
import Link from "next/link";
import { AppIcon } from "@/components/ui/app-icon";
import { MetricCard } from "@/components/ui/metric-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { getAuthenticatedProfile } from "@/lib/auth/profile";
import { getAppDateKey } from "@/lib/date";
import {
  calculateShiftCoverage,
  getCoverageLabel,
  getCoverageTone,
  summarizeCoverage,
  type RoleCoverage,
  type ShiftCoverage,
} from "@/lib/shifts/coverage";
import { createClient } from "@/lib/supabase/server";

type ShiftListView = "upcoming" | "needs-staff" | "past";

const PAST_SHIFT_LIMIT = 50;

const SHIFT_COLUMNS = `
  id,
  event_name,
  date,
  start_time,
  end_time,
  location,
  shift_requirements (
    role,
    staff_needed
  ),
  assignments (
    assigned_role
  )
`;

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

function formatDate(date: string) {
  return dateFormatter.format(new Date(`${date}T00:00:00Z`));
}

function formatTime(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const twelveHour = hours % 12 || 12;

  return `${twelveHour}:${String(minutes).padStart(2, "0")} ${period}`;
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseView(value: string | undefined): ShiftListView {
  return value === "past" || value === "needs-staff" ? value : "upcoming";
}

function getRolePillClasses(role: RoleCoverage) {
  if (role.open === 0) {
    return "bg-emerald-50 text-emerald-800 ring-emerald-200";
  }

  if (role.filled > 0) {
    return "bg-amber-50 text-amber-900 ring-amber-200";
  }

  return "bg-slate-100 text-slate-700 ring-slate-200";
}

export default async function AdminShiftsPage({
  searchParams,
}: {
  searchParams: Promise<{
    created?: string | string[];
    view?: string | string[];
  }>;
}) {
  const profile = await getAuthenticatedProfile();

  if (profile.role !== "admin") {
    redirect("/dashboard");
  }

  const { created, view: viewParam } = await searchParams;
  const view = parseView(firstValue(viewParam));
  const todayKey = getAppDateKey();
  const supabase = await createClient();

  // Upcoming shifts are always loaded in full so the coverage summary
  // describes the whole upcoming schedule. Past shifts are only counted,
  // and loaded (most recent first, capped) when the Past tab is open.
  const [upcomingResult, pastCountResult, pastResult] = await Promise.all([
    supabase
      .from("shifts")
      .select(SHIFT_COLUMNS)
      .gte("date", todayKey)
      .order("date", { ascending: true })
      .order("start_time", { ascending: true }),
    supabase
      .from("shifts")
      .select("id", { count: "exact", head: true })
      .lt("date", todayKey),
    view === "past"
      ? supabase
          .from("shifts")
          .select(SHIFT_COLUMNS)
          .lt("date", todayKey)
          .order("date", { ascending: false })
          .order("start_time", { ascending: false })
          .limit(PAST_SHIFT_LIMIT)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (upcomingResult.error || pastCountResult.error || pastResult.error) {
    throw new Error("Unable to load shifts.");
  }

  const upcomingShifts = upcomingResult.data;
  const pastCount = pastCountResult.count ?? 0;
  const coverageById = new Map<string, ShiftCoverage>();

  for (const shift of [...upcomingShifts, ...(pastResult.data ?? [])]) {
    coverageById.set(
      shift.id,
      calculateShiftCoverage(shift.shift_requirements, shift.assignments),
    );
  }

  const upcomingCoverage = upcomingShifts.map(
    (shift) => coverageById.get(shift.id)!,
  );
  const coverageSummary = summarizeCoverage(upcomingCoverage);
  const needsStaffShifts = upcomingShifts.filter((shift) => {
    const status = coverageById.get(shift.id)?.status;
    return status === "partially_staffed" || status === "unstaffed";
  });

  const visibleShifts =
    view === "past"
      ? (pastResult.data ?? [])
      : view === "needs-staff"
        ? needsStaffShifts
        : upcomingShifts;

  const tabs: Array<{ view: ShiftListView; label: string; count: number }> = [
    { view: "upcoming", label: "Upcoming", count: upcomingShifts.length },
    { view: "needs-staff", label: "Needs staff", count: needsStaffShifts.length },
    { view: "past", label: "Past", count: pastCount },
  ];

  const createdValue = firstValue(created);
  const createdCount =
    createdValue && /^\d+$/.test(createdValue)
      ? Number(createdValue)
      : null;
  const hasAnyShifts = upcomingShifts.length > 0 || pastCount > 0;

  const emptyMessage =
    view === "past"
      ? { title: "No past shifts", body: "Shifts move here after their date passes." }
      : view === "needs-staff"
        ? {
            title: "Every upcoming shift is staffed",
            body: "Nothing needs attention right now.",
          }
        : {
            title: "No upcoming shifts",
            body: "Create a shift or a recurring schedule to get started.",
          };

  return (
    <main className="page-shell">
      <div className="page-container">
        <header className="page-header">
          <div>
            <p className="page-eyebrow">Scheduling</p>
            <h1 className="page-title">Shifts</h1>
            <p className="page-description">
              See which shifts still need people, and open one to assign staff.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              href="/admin/shifts/recurring"
              className="btn btn-secondary"
            >
              <AppIcon name="schedule" className="h-4 w-4" />
              Recurring Shifts
            </Link>
            <Link
              href="/admin/shifts/new"
              className="btn btn-primary"
            >
              <AppIcon name="plus" className="h-4 w-4" />
              New Shift
            </Link>
          </div>
        </header>

        {createdCount !== null && createdCount >= 1 && createdCount <= 120 ? (
          <p role="status" className="alert-success mb-6" aria-live="polite">
            {createdCount} {createdCount === 1 ? "shift was" : "shifts were"}{" "}
            created successfully.
          </p>
        ) : null}

        {!hasAnyShifts ? (
          <div className="empty-state">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
              <AppIcon name="calendar" className="h-6 w-6" />
            </span>
            <h2 className="mt-4 text-lg font-semibold text-slate-900">
              No shifts found
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Get started by creating a new shift for an upcoming event.
            </p>
            <Link
              href="/admin/shifts/new"
              className="btn btn-primary mt-6"
            >
              Create your first shift
            </Link>
          </div>
        ) : (
          <>
            <section aria-labelledby="coverage-heading" className="mb-6">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                <h2 id="coverage-heading" className="section-title">
                  Upcoming staffing coverage
                </h2>
                <p className="text-sm text-slate-500">
                  All shifts from {formatDate(todayKey)} onward (Pacific time)
                </p>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <MetricCard
                  label="Upcoming shifts"
                  value={coverageSummary.shiftCount}
                  tone="indigo"
                  icon={<AppIcon name="calendar" className="h-4 w-4" />}
                  description="Dated today or later"
                />
                <MetricCard
                  label="Fully staffed"
                  value={coverageSummary.fullyStaffed}
                  tone="emerald"
                  icon={<AppIcon name="check" className="h-4 w-4" />}
                  description="Every role filled"
                />
                <MetricCard
                  label="Needs staff"
                  value={coverageSummary.needsStaff}
                  tone="amber"
                  icon={<AppIcon name="users" className="h-4 w-4" />}
                  description="At least one open slot"
                />
                <MetricCard
                  label="Open slots"
                  value={coverageSummary.openSlots}
                  tone="slate"
                  icon={<AppIcon name="plus" className="h-4 w-4" />}
                  description="Unfilled positions"
                />
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Counts confirmed assignments only. Availability responses are
                not counted.
                {coverageSummary.noRequirements > 0
                  ? ` ${coverageSummary.noRequirements} upcoming ${
                      coverageSummary.noRequirements === 1
                        ? "shift has"
                        : "shifts have"
                    } no staffing requirements and ${
                      coverageSummary.noRequirements === 1 ? "is" : "are"
                    } not counted as staffed or needing staff.`
                  : null}
              </p>
            </section>

            <nav
              aria-label="Shift list views"
              className="mb-4 flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1"
            >
              {tabs.map((tab) => {
                const isActive = tab.view === view;

                return (
                  <Link
                    key={tab.view}
                    href={
                      tab.view === "upcoming"
                        ? "/admin/shifts"
                        : `/admin/shifts?view=${tab.view}`
                    }
                    aria-current={isActive ? "page" : undefined}
                    className={`flex min-h-10 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-semibold transition ${
                      isActive
                        ? "bg-white text-slate-950 shadow-sm"
                        : "text-slate-600 hover:text-slate-950"
                    }`}
                  >
                    {tab.label}
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${
                        isActive
                          ? tab.view === "needs-staff" && tab.count > 0
                            ? "bg-amber-100 text-amber-800"
                            : "bg-indigo-100 text-indigo-700"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {tab.count}
                    </span>
                  </Link>
                );
              })}
            </nav>

            {view === "past" && pastCount > PAST_SHIFT_LIMIT ? (
              <p className="mb-4 text-sm text-slate-500">
                Showing the {PAST_SHIFT_LIMIT} most recent of {pastCount} past
                shifts.
              </p>
            ) : null}

            {visibleShifts.length === 0 ? (
              <div className="empty-state p-8">
                <h2 className="text-base font-semibold text-slate-900">
                  {emptyMessage.title}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {emptyMessage.body}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {visibleShifts.map((shift) => {
                  const coverage = coverageById.get(shift.id)!;
                  const isUpcoming = shift.date >= todayKey;

                  return (
                    <article
                      key={shift.id}
                      className="surface-card p-5 sm:p-6"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <h2 className="break-words text-xl font-semibold tracking-tight text-slate-950">
                            {shift.event_name}
                          </h2>
                          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
                            <p className="flex items-center gap-2">
                              <AppIcon name="calendar" className="h-4 w-4 text-indigo-500" />
                              {formatDate(shift.date)}
                            </p>
                            <p className="flex items-center gap-2">
                              <AppIcon name="clock" className="h-4 w-4 text-indigo-500" />
                              {formatTime(shift.start_time)} – {formatTime(shift.end_time)}
                            </p>
                            {shift.location ? (
                              <p className="flex items-center gap-2">
                                <AppIcon name="location" className="h-4 w-4 text-indigo-500" />
                                {shift.location}
                              </p>
                            ) : null}
                          </div>
                        </div>
                        <Link
                          href={`/admin/shifts/${shift.id}`}
                          className="btn btn-secondary self-start"
                        >
                          {isUpcoming ? "Manage Staffing" : "View Details"}
                        </Link>
                      </div>
                      <div className="mt-5 border-t border-slate-100 pt-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                            <AppIcon name="users" className="h-4 w-4 text-indigo-500" />
                            Staffing
                          </h3>
                          {isUpcoming ? (
                            <StatusBadge tone={getCoverageTone(coverage)}>
                              {getCoverageLabel(coverage)}
                            </StatusBadge>
                          ) : null}
                        </div>
                        {coverage.roles.length > 0 ? (
                          <ul className="mt-3 flex flex-wrap gap-2">
                            {coverage.roles.map((role) => (
                              <li
                                key={role.role}
                                className={`rounded-full px-3 py-1.5 text-sm ring-1 ring-inset ${getRolePillClasses(role)}`}
                              >
                                {role.role}{" "}
                                <span className="font-semibold tabular-nums">
                                  {role.filled} / {role.needed}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-3 text-sm text-slate-500">
                            No staffing requirements set.
                          </p>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
