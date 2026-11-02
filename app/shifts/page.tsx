import Link from "next/link";

import { AppIcon } from "@/components/ui/app-icon";
import { StatusBadge } from "@/components/ui/status-badge";
import { getAuthenticatedProfile } from "@/lib/auth/profile";
import { APP_TIME_ZONE, getAppDateKey } from "@/lib/date";
import { createClient } from "@/lib/supabase/server";
import {
  AvailabilityForm,
  type ExistingAvailability,
} from "./availability-form";
import type { AvailabilityResponse } from "./actions";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const deadlineFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: APP_TIME_ZONE,
});

function formatShiftDate(date: string) {
  return dateFormatter.format(new Date(`${date}T00:00:00Z`));
}

function formatShiftTime(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const twelveHour = hours % 12 || 12;

  return `${twelveHour}:${String(minutes).padStart(2, "0")} ${period}`;
}

function formatResponseDeadline(deadline: string) {
  return deadlineFormatter.format(new Date(deadline)).replace(",", " at");
}

function formatAvailabilityResponse(response: AvailabilityResponse) {
  return response.charAt(0).toUpperCase() + response.slice(1);
}

function isAvailabilityResponse(value: string): value is AvailabilityResponse {
  return value === "yes" || value === "maybe" || value === "no";
}

export default async function ShiftsPage() {
  const profile = await getAuthenticatedProfile();

  const supabase = await createClient();
  const requestTime = new Date();
  const today = getAppDateKey(requestTime);
  const requestTimestamp = requestTime.getTime();
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
      notes,
      response_deadline,
      shift_requirements (
        role,
        staff_needed
      )
    `,
    )
    .gte("date", today)
    .order("date", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) {
    throw new Error("Unable to load upcoming shifts.");
  }

  const availabilityByShift = new Map<string, ExistingAvailability>();
  const assignedRoleByShift = new Map<string, string>();

  if (shifts.length > 0) {
    const shiftIds = shifts.map((shift) => shift.id);
    const [availabilityResult, assignmentResult] = await Promise.all([
      supabase
        .from("availability_responses")
        .select(
          "shift_id, response, suggested_start_time, suggested_end_time, note",
        )
        .eq("user_id", profile.id)
        .in("shift_id", shiftIds),
      supabase
        .from("assignments")
        .select("shift_id, assigned_role")
        .eq("user_id", profile.id)
        .in("shift_id", shiftIds),
    ]);

    if (availabilityResult.error) {
      throw new Error("Unable to load your availability responses.");
    }

    if (assignmentResult.error) {
      throw new Error("Unable to load your assignments.");
    }

    for (const availability of availabilityResult.data) {
      if (!isAvailabilityResponse(availability.response)) {
        throw new Error("An availability response has an invalid status.");
      }

      availabilityByShift.set(availability.shift_id, {
        response: availability.response,
        suggestedStartTime: availability.suggested_start_time,
        suggestedEndTime: availability.suggested_end_time,
        note: availability.note,
      });
    }

    for (const assignment of assignmentResult.data) {
      assignedRoleByShift.set(assignment.shift_id, assignment.assigned_role);
    }
  }

  type ShiftRow = (typeof shifts)[number];
  const isOpen = (shift: ShiftRow) =>
    new Date(shift.response_deadline).getTime() > requestTimestamp;
  const needsAnswer = shifts.filter(
    (shift) =>
      isOpen(shift) &&
      !availabilityByShift.has(shift.id) &&
      !assignedRoleByShift.has(shift.id),
  );
  const answered = shifts.filter(
    (shift) =>
      isOpen(shift) &&
      (availabilityByShift.has(shift.id) || assignedRoleByShift.has(shift.id)),
  );
  const closed = shifts.filter((shift) => !isOpen(shift));

  function renderShift(shift: ShiftRow) {
    const initialAvailability = availabilityByShift.get(shift.id) ?? null;
    const assignedRole = assignedRoleByShift.get(shift.id) ?? null;
    const deadlinePassed = !isOpen(shift);

    return (
      <article
        key={shift.id}
        id={`shift-${shift.id}`}
        className="surface-card scroll-mt-32 overflow-hidden p-5 sm:p-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h3 className="break-words text-lg font-semibold tracking-tight text-slate-950">
            {shift.event_name}
          </h3>
          {assignedRole ? (
            <StatusBadge tone="emerald">
              <AppIcon name="check" className="h-3.5 w-3.5" />
              You&apos;re working
            </StatusBadge>
          ) : initialAvailability ? (
            <StatusBadge
              tone={
                initialAvailability.response === "yes"
                  ? "emerald"
                  : initialAvailability.response === "maybe"
                    ? "amber"
                    : "rose"
              }
            >
              You said {formatAvailabilityResponse(initialAvailability.response).toLowerCase()}
            </StatusBadge>
          ) : deadlinePassed ? (
            <StatusBadge>No answer</StatusBadge>
          ) : (
            <StatusBadge tone="indigo">Needs your answer</StatusBadge>
          )}
        </div>
        <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
          <p className="flex items-center gap-2 font-medium text-slate-800">
            <AppIcon name="calendar" className="h-4 w-4 text-indigo-500" />
            {formatShiftDate(shift.date)}
          </p>
          <p className="flex items-center gap-2">
            <AppIcon name="clock" className="h-4 w-4 text-indigo-500" />
            {formatShiftTime(shift.start_time)} –{" "}
            {formatShiftTime(shift.end_time)}
          </p>
          {shift.location ? (
            <p className="flex items-center gap-2 sm:col-span-2">
              <AppIcon name="location" className="h-4 w-4 text-indigo-500" />
              {shift.location}
            </p>
          ) : null}
          {shift.shift_requirements.length > 0 ? (
            <p className="flex items-start gap-2 sm:col-span-2">
              <AppIcon name="users" className="mt-0.5 h-4 w-4 text-indigo-500" />
              <span>
                Needs{" "}
                {[...shift.shift_requirements]
                  .sort((first, second) => first.role.localeCompare(second.role))
                  .map((requirement) => `${requirement.staff_needed} ${requirement.role}`)
                  .join(", ")}
              </span>
            </p>
          ) : null}
        </div>

        {shift.notes ? (
          <p className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-100">
            {shift.notes}
          </p>
        ) : null}

        {!deadlinePassed && !assignedRole ? (
          <p className="mt-3 text-sm text-slate-500">
            Answer by {formatResponseDeadline(shift.response_deadline)}
          </p>
        ) : null}

        {assignedRole ? (
          <div className="mt-4 flex flex-col gap-3 rounded-xl bg-emerald-50 p-4 ring-1 ring-emerald-100 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-emerald-900">
              You&apos;re confirmed as <span className="font-semibold">{assignedRole}</span>.
            </p>
            <Link href="/schedule" className="btn btn-secondary">
              View in My Schedule
            </Link>
          </div>
        ) : (
          <AvailabilityForm
            shiftId={shift.id}
            deadlinePassed={deadlinePassed}
            initialAvailability={initialAvailability}
          />
        )}
      </article>
    );
  }

  const sections = [
    {
      id: "needs-answer",
      title: "Needs your answer",
      description: "Can you work these? Answer before the deadline.",
      shifts: needsAnswer,
    },
    {
      id: "answered",
      title: "Already answered",
      description: "You can change your answer until the deadline.",
      shifts: answered,
    },
    {
      id: "closed",
      title: "Answers closed",
      description: "The deadline has passed for these shifts.",
      shifts: closed,
    },
  ].filter((section) => section.shifts.length > 0);

  return (
    <main className="page-shell">
      <div className="mx-auto max-w-4xl">
        <header className="page-header">
          <div>
            <p className="page-eyebrow">Upcoming shifts</p>
            <h1 className="page-title">Availability</h1>
            <p className="page-description">
              Tell your manager which shifts you can work. Saying yes doesn&apos;t
              book you. Your manager confirms who works, and confirmed shifts
              appear in My Schedule.
            </p>
          </div>
        </header>

        {shifts.length === 0 ? (
          <section className="empty-state">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
              <AppIcon name="calendar" className="h-6 w-6" />
            </span>
            <h2 className="mt-4 text-lg font-semibold text-slate-900">
              No upcoming shifts
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              When your manager posts new shifts, they&apos;ll show up here.
            </p>
          </section>
        ) : (
          <div className="space-y-10">
            {needsAnswer.length === 0 ? (
              <p className="alert-success">
                {answered.length > 0
                  ? "You're all caught up. Every open shift has your answer."
                  : "No shifts are open for answers right now."}
              </p>
            ) : null}
            {sections.map((section) => (
              <section key={section.id} aria-labelledby={`${section.id}-heading`}>
                <div className="mb-3">
                  <h2 id={`${section.id}-heading`} className="section-title">
                    {section.title}{" "}
                    <span className="text-base font-medium text-slate-400">
                      ({section.shifts.length})
                    </span>
                  </h2>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {section.description}
                  </p>
                </div>
                <div className="space-y-4">{section.shifts.map(renderShift)}</div>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
