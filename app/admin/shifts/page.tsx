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
  type ShiftCoverage,
} from "@/lib/shifts/coverage";
import { createClient } from "@/lib/supabase/server";

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

export default async function AdminShiftsPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string | string[] }>;
}) {
  const profile = await getAuthenticatedProfile();

  if (profile.role !== "admin") {
    redirect("/dashboard");
  }

  const supabase = await createClient();

  const { data: shifts, error } = await supabase
    .from("shifts")
    .select(
      `
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
    `,
    )
    .order("date", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) {
    throw new Error("Unable to load shifts.");
  }

  // Coverage covers every shift dated today (Pacific time) or later. This
  // page loads all shifts without pagination, so the summary is complete.
  const todayKey = getAppDateKey();
  const upcomingCoverage = new Map<string, ShiftCoverage>();

  for (const shift of shifts) {
    if (shift.date >= todayKey) {
      upcomingCoverage.set(
        shift.id,
        calculateShiftCoverage(shift.shift_requirements, shift.assignments),
      );
    }
  }

  const coverageSummary = summarizeCoverage([...upcomingCoverage.values()]);

  const { created } = await searchParams;
  const createdValue = Array.isArray(created) ? created[0] : created;
  const createdCount =
    createdValue && /^\d+$/.test(createdValue)
      ? Number(createdValue)
      : null;

  return (
    <main className="page-shell">
      <div className="page-container">
        <header className="page-header">
          <div>
            <p className="page-eyebrow">Shift management</p>
            <h1 className="page-title">Shifts</h1>
            <p className="page-description">
              Review event staffing, responses, and assignments.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              href="/admin/shifts/recurring"
              className="btn btn-secondary"
            >
              <AppIcon name="schedule" className="h-4 w-4" />
              Create Recurring Shifts
            </Link>
            <Link
              href="/admin/shifts/new"
              className="btn btn-primary"
            >
              <AppIcon name="plus" className="h-4 w-4" />
              Create Shift
            </Link>
          </div>
        </header>

        {createdCount !== null && createdCount >= 1 && createdCount <= 120 ? (
          <p role="status" className="alert-success mb-6" aria-live="polite">
            {createdCount} {createdCount === 1 ? "shift was" : "shifts were"}{" "}
            created successfully.
          </p>
        ) : null}

        {shifts.length > 0 ? (
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
              Counts confirmed assignments only. Availability responses are not
              counted.
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
        ) : null}

        {shifts.length === 0 ? (
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
          <div className="space-y-4">
            {shifts.map((shift) => {
              const coverage = upcomingCoverage.get(shift.id);

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
                      View Responses
                    </Link>
                  </div>
                  <div className="mt-5 border-t border-slate-100 pt-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <AppIcon name="users" className="h-4 w-4 text-indigo-500" />
                        Staffing requirements
                      </h3>
                      {coverage ? (
                        <StatusBadge tone={getCoverageTone(coverage)}>
                          {getCoverageLabel(coverage)}
                        </StatusBadge>
                      ) : null}
                    </div>
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {shift.shift_requirements?.map(
                        (req: { role: string; staff_needed: number }) => (
                          <li
                            key={req.role}
                            className="rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-700"
                          >
                            {req.role} × {req.staff_needed}
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
