import Link from "next/link";

import { AppIcon } from "@/components/ui/app-icon";
import { MetricCard } from "@/components/ui/metric-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { getAuthenticatedProfile } from "@/lib/auth/profile";
import { getAppDateKey } from "@/lib/date";
import {
  formatMinutes,
  getShiftMinutes,
  getWeekStart,
  getWeeklyMinutes,
} from "@/lib/shifts/hours";
import {
  REPLACEMENT_COLUMNS,
  isMissingReplacementSchema,
  latestRequestByShift,
  type ReplacementRequest,
} from "@/lib/replacements/shared";
import { createClient } from "@/lib/supabase/server";
import { ReplacementControl } from "./replacement-control";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
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

export default async function SchedulePage() {
  const profile = await getAuthenticatedProfile();
  const supabase = await createClient();
  const today = getAppDateKey();
  // Load from the start of this week so hours already worked this week count.
  const weekStart = getWeekStart(today);
  const { data: assignments, error } = await supabase
    .from("assignments")
    .select("id, shift_id, assigned_role")
    .eq("user_id", profile.id);

  if (error) {
    throw new Error("Unable to load your confirmed schedule.");
  }

  let schedule: Array<{
    id: string;
    assignedRole: string;
    shift: {
      id: string;
      event_name: string;
      date: string;
      start_time: string;
      end_time: string;
      location: string | null;
      notes: string | null;
    };
  }> = [];

  if (assignments.length > 0) {
    const { data: shifts, error: shiftsError } = await supabase
      .from("shifts")
      .select("id, event_name, date, start_time, end_time, location, notes")
      .in(
        "id",
        assignments.map((assignment) => assignment.shift_id),
      )
      .gte("date", weekStart);

    if (shiftsError) {
      throw new Error("Unable to load your assigned shifts.");
    }

    const shiftsById = new Map(shifts.map((shift) => [shift.id, shift]));

    schedule = assignments.flatMap((assignment) => {
      const shift = shiftsById.get(assignment.shift_id);

      return shift
        ? [
            {
              id: assignment.id,
              assignedRole: assignment.assigned_role,
              shift,
            },
          ]
        : [];
    });
  }

  const weeklyMinutes = getWeeklyMinutes(
    schedule.map((assignment) => assignment.shift),
    today,
  );
  schedule = schedule.filter((assignment) => assignment.shift.date >= today);

  // Replacement requests are optional: if the table hasn't been created yet
  // the control is hidden instead of breaking the page.
  let replacementsEnabled = false;
  let latestRequests = new Map<string, ReplacementRequest>();

  if (schedule.length > 0) {
    const { data: requests, error: requestsError } = await supabase
      .from("replacement_requests")
      .select(REPLACEMENT_COLUMNS)
      .eq("requested_by", profile.id)
      .in(
        "shift_id",
        schedule.map((assignment) => assignment.shift.id),
      );

    if (requestsError && !isMissingReplacementSchema(requestsError)) {
      throw new Error("Unable to load your replacement requests.");
    }

    replacementsEnabled = !requestsError;
    latestRequests = latestRequestByShift(
      (requests ?? []) as ReplacementRequest[],
    );
  }

  schedule.sort((first, second) => {
    const dateDifference = first.shift.date.localeCompare(second.shift.date);

    if (dateDifference !== 0) {
      return dateDifference;
    }

    return first.shift.start_time.localeCompare(second.shift.start_time);
  });

  return (
    <main className="page-shell">
      <div className="mx-auto max-w-4xl">
        <header className="page-header">
          <div>
            <p className="page-eyebrow">Confirmed assignments</p>
            <h1 className="page-title">My Schedule</h1>
            <p className="page-description">
              Your confirmed upcoming shifts.
            </p>
          </div>
        </header>

        <section
          aria-label="Scheduled hours"
          className="mb-6 grid grid-cols-3 gap-3"
        >
          <MetricCard
            label="This week"
            value={formatMinutes(weeklyMinutes.thisWeek)}
            tone="indigo"
            icon={<AppIcon name="clock" className="h-4 w-4" />}
            description="Mon–Sun, confirmed"
          />
          <MetricCard
            label="Next week"
            value={formatMinutes(weeklyMinutes.nextWeek)}
            tone="slate"
            icon={<AppIcon name="clock" className="h-4 w-4" />}
            description="Mon–Sun, confirmed"
          />
          <MetricCard
            label="Upcoming"
            value={schedule.length}
            tone="emerald"
            icon={<AppIcon name="check" className="h-4 w-4" />}
            description={schedule.length === 1 ? "Shift" : "Shifts"}
          />
        </section>

        {schedule.length === 0 ? (
          <section className="empty-state">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
              <AppIcon name="schedule" className="h-6 w-6" />
            </span>
            <h2 className="mt-4 text-lg font-semibold text-slate-900">
              No upcoming shifts yet
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              When a manager assigns you to a shift, it shows up here.
            </p>
            <Link href="/shifts" className="btn btn-primary mt-5">
              Share your availability
            </Link>
          </section>
        ) : (
          <div className="space-y-4">
            {schedule.map((assignment) => (
              <article
                key={assignment.id}
                className="surface-card relative overflow-hidden p-5 sm:p-6"
              >
                <div className="absolute inset-y-0 left-0 w-1 bg-emerald-500" />
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h2 className="text-xl font-semibold tracking-tight text-slate-950">
                    {assignment.shift.event_name}
                  </h2>
                  <StatusBadge tone="emerald">
                    <AppIcon name="check" className="h-3.5 w-3.5" />
                    Assigned
                  </StatusBadge>
                </div>
                <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                  <p className="flex items-center gap-2 font-medium text-slate-800">
                    <AppIcon name="calendar" className="h-4 w-4 text-indigo-500" />
                    {formatDate(assignment.shift.date)}
                  </p>
                  <p className="flex items-center gap-2">
                    <AppIcon name="clock" className="h-4 w-4 text-indigo-500" />
                    {formatTime(assignment.shift.start_time)} –{" "}
                    {formatTime(assignment.shift.end_time)}
                    <span className="text-slate-400">
                      · {formatMinutes(getShiftMinutes(assignment.shift))}
                    </span>
                  </p>
                  {assignment.shift.location ? (
                    <p className="flex items-center gap-2 sm:col-span-2">
                      <AppIcon name="location" className="h-4 w-4 text-indigo-500" />
                      {assignment.shift.location}
                    </p>
                  ) : null}
                </div>

                <div className="mt-5 rounded-xl bg-emerald-50 px-4 py-3 ring-1 ring-emerald-100">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Assigned role
                  </p>
                  <p className="mt-1 font-semibold text-emerald-900">
                    {assignment.assignedRole}
                  </p>
                </div>

                {assignment.shift.notes ? (
                  <div className="mt-4 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-100">
                    <h3 className="text-sm font-semibold text-slate-900">
                      Notes
                    </h3>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                      {assignment.shift.notes}
                    </p>
                  </div>
                ) : null}

                {replacementsEnabled ? (
                  <ReplacementControl
                    shiftId={assignment.shift.id}
                    latestRequest={
                      latestRequests.get(assignment.shift.id) ?? null
                    }
                  />
                ) : null}
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
