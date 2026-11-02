import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppIcon } from "@/components/ui/app-icon";
import { StatusBadge } from "@/components/ui/status-badge";
import { getAuthenticatedProfile } from "@/lib/auth/profile";
import { APP_TIME_ZONE } from "@/lib/date";
import {
  findAssignmentConflicts,
  type ConflictingShift,
} from "@/lib/shifts/conflicts";
import {
  addDays,
  formatMinutes,
  getShiftMinutes,
  getWeekStart,
} from "@/lib/shifts/hours";
import {
  REPLACEMENT_COLUMNS,
  isMissingReplacementSchema,
  type ReplacementRequest,
} from "@/lib/replacements/shared";
import { createClient } from "@/lib/supabase/server";
import { DeleteShiftControl } from "./delete-shift-control";
import { ReplacementReview } from "./replacement-review";
import {
  StaffAssignmentControl,
  type AssignmentRoleOption,
} from "./assignment-control";

type AvailabilityResponse = "yes" | "maybe" | "no";
type AvailabilityStatus = AvailabilityResponse | "no_response";

type StaffAvailability = {
  id: string;
  fullName: string;
  username: string;
  response: {
    status: AvailabilityResponse;
    suggestedStartTime: string | null;
    suggestedEndTime: string | null;
    note: string | null;
  } | null;
  assignedRole: string | null;
  conflicts: ConflictingShift[];
  weekMinutes: number;
  pendingReplacement: ReplacementRequest | null;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const statusOrder: Record<AvailabilityStatus, number> = {
  yes: 0,
  maybe: 1,
  no: 2,
  no_response: 3,
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const deadlineDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: APP_TIME_ZONE,
});

const deadlineTimeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: APP_TIME_ZONE,
});

function isAvailabilityResponse(value: string): value is AvailabilityResponse {
  return value === "yes" || value === "maybe" || value === "no";
}

function formatDate(date: string) {
  return dateFormatter.format(new Date(`${date}T00:00:00Z`));
}

function formatTime(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const twelveHour = hours % 12 || 12;

  return `${twelveHour}:${String(minutes).padStart(2, "0")} ${period}`;
}

const weekStartFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function formatWeekStart(date: string) {
  return weekStartFormatter.format(new Date(`${date}T00:00:00Z`));
}

function hasPassed(timestamp: string) {
  return new Date(timestamp).getTime() <= Date.now();
}

function formatDeadline(deadline: string) {
  const date = new Date(deadline);

  return `${deadlineDateFormatter.format(date)} at ${deadlineTimeFormatter.format(date)}`;
}

function getStatus(member: StaffAvailability): AvailabilityStatus {
  return member.response?.status ?? "no_response";
}

function getStatusLabel(status: AvailabilityStatus) {
  if (status === "no_response") {
    return "No response";
  }

  return status.charAt(0).toUpperCase() + status.slice(1);
}

function getStatusTone(
  status: AvailabilityStatus,
): "emerald" | "amber" | "rose" | "slate" {
  if (status === "yes") {
    return "emerald";
  }

  if (status === "maybe") {
    return "amber";
  }

  if (status === "no") {
    return "rose";
  }

  return "slate";
}

export default async function AdminShiftDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const authenticatedProfile = await getAuthenticatedProfile();

  if (authenticatedProfile.role !== "admin") {
    redirect("/dashboard");
  }

  const { id } = await params;

  if (!UUID_PATTERN.test(id)) {
    notFound();
  }

  const supabase = await createClient();
  const { data: shift, error: shiftError } = await supabase
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
    .eq("id", id)
    .maybeSingle();

  if (shiftError) {
    throw new Error("Unable to load the shift.");
  }

  if (!shift) {
    notFound();
  }

  const weekStart = getWeekStart(shift.date);
  const [
    profilesResult,
    responsesResult,
    assignmentsResult,
    weekShiftsResult,
    replacementsResult,
  ] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, username")
        .eq("role", "staff"),
      supabase
        .from("availability_responses")
        .select(
          "user_id, response, suggested_start_time, suggested_end_time, note",
        )
        .eq("shift_id", shift.id),
      supabase
        .from("assignments")
        .select("id, user_id, assigned_role")
        .eq("shift_id", shift.id),
      // Every shift in this shift's week (Mon–Sun): used for overlap
      // warnings and each person's scheduled hours that week.
      supabase
        .from("shifts")
        .select(
          "id, event_name, date, start_time, end_time, assignments ( user_id, assigned_role )",
        )
        .gte("date", weekStart)
        .lte("date", addDays(weekStart, 6)),
      supabase
        .from("replacement_requests")
        .select(REPLACEMENT_COLUMNS)
        .eq("shift_id", shift.id)
        .eq("status", "pending"),
    ]);

  if (profilesResult.error) {
    throw new Error("Unable to load staff profiles.");
  }

  if (responsesResult.error) {
    throw new Error("Unable to load availability responses.");
  }

  if (assignmentsResult.error) {
    throw new Error("Unable to load assignments.");
  }

  if (weekShiftsResult.error) {
    throw new Error("Unable to check for scheduling conflicts.");
  }

  // Replacement requests are optional until their migration has been run.
  if (
    replacementsResult.error &&
    !isMissingReplacementSchema(replacementsResult.error)
  ) {
    throw new Error("Unable to load replacement requests.");
  }

  const pendingReplacementByUser = new Map(
    ((replacementsResult.data ?? []) as ReplacementRequest[]).map((request) => [
      request.requested_by,
      request,
    ]),
  );

  const conflictsByUser = findAssignmentConflicts(
    shift,
    weekShiftsResult.data.filter((other) => other.date === shift.date),
  );
  const weekMinutesByUser = new Map<string, number>();

  for (const weekShift of weekShiftsResult.data) {
    for (const assignment of weekShift.assignments ?? []) {
      weekMinutesByUser.set(
        assignment.user_id,
        (weekMinutesByUser.get(assignment.user_id) ?? 0) +
          getShiftMinutes(weekShift),
      );
    }
  }

  const responsesByUser = new Map(
    responsesResult.data.map((response) => [response.user_id, response]),
  );
  const assignmentsByUser = new Map(
    assignmentsResult.data.map((assignment) => [assignment.user_id, assignment]),
  );

  const assignedCounts = new Map(
    shift.shift_requirements.map((requirement) => [requirement.role, 0]),
  );

  for (const assignment of assignmentsResult.data) {
    const currentCount = assignedCounts.get(assignment.assigned_role);

    if (currentCount !== undefined) {
      assignedCounts.set(assignment.assigned_role, currentCount + 1);
    }
  }

  const assignmentRoles: AssignmentRoleOption[] = shift.shift_requirements
    .map((requirement) => ({
      role: requirement.role,
      staffNeeded: requirement.staff_needed,
      assignedCount: assignedCounts.get(requirement.role) ?? 0,
    }))
    .sort((first, second) => first.role.localeCompare(second.role));

  const staff: StaffAvailability[] = profilesResult.data.map((profile) => {
    const response = responsesByUser.get(profile.id);
    const assignment = assignmentsByUser.get(profile.id);

    if (response && !isAvailabilityResponse(response.response)) {
      throw new Error("An availability response has an invalid status.");
    }

    return {
      id: profile.id,
      fullName: profile.full_name,
      username: profile.username,
      response: response
        ? {
            status: response.response,
            suggestedStartTime: response.suggested_start_time,
            suggestedEndTime: response.suggested_end_time,
            note: response.note,
          }
        : null,
      assignedRole: assignment?.assigned_role ?? null,
      conflicts: conflictsByUser.get(profile.id) ?? [],
      weekMinutes: weekMinutesByUser.get(profile.id) ?? 0,
      pendingReplacement: assignment
        ? (pendingReplacementByUser.get(profile.id) ?? null)
        : null,
    };
  });

  staff.sort((first, second) => {
    const statusDifference =
      statusOrder[getStatus(first)] - statusOrder[getStatus(second)];

    if (statusDifference !== 0) {
      return statusDifference;
    }

    const nameDifference = first.fullName.localeCompare(second.fullName, "en", {
      sensitivity: "base",
    });

    if (nameDifference !== 0) {
      return nameDifference;
    }

    return first.username.localeCompare(second.username, "en", {
      sensitivity: "base",
    });
  });

  const filledSlots = assignmentRoles.reduce(
    (total, role) => total + Math.min(role.assignedCount, role.staffNeeded),
    0,
  );
  const requiredSlots = assignmentRoles.reduce(
    (total, role) => total + role.staffNeeded,
    0,
  );
  const deadlinePassed = hasPassed(shift.response_deadline);
  const shiftId = shift.id;

  const groups: Array<{
    key: string;
    title: string;
    hint: string;
    members: StaffAvailability[];
  }> = [
    {
      key: "assigned",
      title: "Working this shift",
      hint: "Confirmed. They see this shift in their schedule.",
      members: staff.filter((member) => member.assignedRole),
    },
    {
      key: "yes",
      title: "Said yes",
      hint: "Available for the whole shift. Best people to assign.",
      members: staff.filter(
        (member) => !member.assignedRole && getStatus(member) === "yes",
      ),
    },
    {
      key: "maybe",
      title: "Said maybe",
      hint: "Available for part of the shift.",
      members: staff.filter(
        (member) => !member.assignedRole && getStatus(member) === "maybe",
      ),
    },
    {
      key: "no_response",
      title: "No answer yet",
      hint: "Haven't responded. You can still assign them.",
      members: staff.filter(
        (member) => !member.assignedRole && getStatus(member) === "no_response",
      ),
    },
    {
      key: "no",
      title: "Said no",
      hint: "Can't work this shift.",
      members: staff.filter(
        (member) => !member.assignedRole && getStatus(member) === "no",
      ),
    },
  ].filter((group) => group.members.length > 0);

  function renderMember(member: StaffAvailability) {
    const status = getStatus(member);

    return (
      <li key={member.id} className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-slate-900">{member.fullName}</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
              <span>@{member.username}</span>
              <span className="flex items-center gap-1">
                <AppIcon name="clock" className="h-3.5 w-3.5 text-indigo-500" />
                <span className="font-semibold tabular-nums text-slate-700">
                  {formatMinutes(member.weekMinutes)}
                </span>{" "}
                scheduled week of {formatWeekStart(weekStart)}
              </span>
            </p>
          </div>
          {member.assignedRole ? (
            <StatusBadge tone={getStatusTone(status)}>
              {status === "no_response" ? "No answer" : `Said ${getStatusLabel(status).toLowerCase()}`}
            </StatusBadge>
          ) : null}
        </div>

        {member.response?.status === "maybe" &&
        (member.response.suggestedStartTime || member.response.suggestedEndTime) ? (
          <p className="mt-2 text-sm text-amber-900">
            Can work{" "}
            {member.response.suggestedStartTime
              ? `from ${formatTime(member.response.suggestedStartTime)}`
              : ""}
            {member.response.suggestedStartTime && member.response.suggestedEndTime
              ? " "
              : ""}
            {member.response.suggestedEndTime
              ? `until ${formatTime(member.response.suggestedEndTime)}`
              : ""}
          </p>
        ) : null}

        {member.response?.note ? (
          <p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
            “{member.response.note}”
          </p>
        ) : null}

        {member.conflicts.length > 0 ? (
          <div
            role="note"
            className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900"
          >
            <p className="font-semibold">
              {member.assignedRole
                ? "Double-booked: also assigned to an overlapping shift"
                : "Already assigned to an overlapping shift"}
            </p>
            <ul className="mt-1 space-y-0.5">
              {member.conflicts.map((conflict) => (
                <li key={conflict.shiftId}>
                  <Link
                    href={`/admin/shifts/${conflict.shiftId}`}
                    className="font-medium underline decoration-amber-400 underline-offset-2 hover:decoration-amber-700"
                  >
                    {conflict.eventName}
                  </Link>{" "}
                  · {formatTime(conflict.startTime)} –{" "}
                  {formatTime(conflict.endTime)} · {conflict.assignedRole}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {member.pendingReplacement ? (
          <ReplacementReview
            requestId={member.pendingReplacement.id}
            shiftId={shiftId}
            reason={member.pendingReplacement.reason}
          />
        ) : null}

        <StaffAssignmentControl
          shiftId={shiftId}
          userId={member.id}
          assignedRole={member.assignedRole}
          roles={assignmentRoles}
        />
      </li>
    );
  }

  return (
    <main className="page-shell">
      <div className="page-container">
        <Link href="/admin/shifts" className="btn btn-ghost mb-4 px-0">
          ← All shifts
        </Link>

        <header className="surface-card p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h1 className="break-words text-2xl font-bold tracking-tight text-slate-950">
                {shift.event_name}
              </h1>
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
              <p className="mt-2 text-sm text-slate-500">
                {deadlinePassed ? "Answers closed " : "Staff answer by "}
                {formatDeadline(shift.response_deadline)}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Link
                href={`/admin/shifts/${shift.id}/edit`}
                className="btn btn-secondary"
              >
                Edit
              </Link>
              <Link
                href={`/admin/shifts/new?duplicate=${shift.id}`}
                className="btn btn-secondary"
              >
                Duplicate
              </Link>
            </div>
          </div>
          {shift.notes ? (
            <p className="mt-4 whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-100">
              {shift.notes}
            </p>
          ) : null}
        </header>

        <section className="mt-6" aria-labelledby="staffing-heading">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="staffing-heading" className="section-title">
              Staffing
            </h2>
            {requiredSlots > 0 ? (
              <StatusBadge
                tone={
                  filledSlots >= requiredSlots
                    ? "emerald"
                    : filledSlots > 0
                      ? "amber"
                      : "slate"
                }
              >
                {filledSlots >= requiredSlots
                  ? "Fully staffed"
                  : `${filledSlots} / ${requiredSlots} filled · ${requiredSlots - filledSlots} open`}
              </StatusBadge>
            ) : null}
          </div>
          {assignmentRoles.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              No roles set. Edit the shift to add the people you need.
            </p>
          ) : (
            <div className="surface-card mt-3 grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
              {assignmentRoles.map((role) => {
                const filled = Math.min(role.assignedCount, role.staffNeeded);
                const full = filled >= role.staffNeeded;

                return (
                  <div key={role.role}>
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="font-semibold text-slate-900">{role.role}</span>
                      <span
                        className={`font-semibold tabular-nums ${full ? "text-emerald-700" : "text-slate-700"}`}
                      >
                        {filled} / {role.staffNeeded}
                      </span>
                    </div>
                    <div
                      role="progressbar"
                      aria-label={`${role.role} staffing progress`}
                      aria-valuemin={0}
                      aria-valuemax={role.staffNeeded}
                      aria-valuenow={filled}
                      className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100"
                    >
                      <div
                        className={`h-full rounded-full ${full ? "bg-emerald-500" : "bg-amber-500"}`}
                        style={{ width: `${(filled / role.staffNeeded) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-8" aria-labelledby="people-heading">
          <h2 id="people-heading" className="section-title">
            Assign people
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Grouped by what each person said about this shift.
          </p>

          {staff.length === 0 ? (
            <div className="empty-state mt-4 p-8">
              <p className="text-sm text-slate-600">
                No staff accounts yet.{" "}
                <Link href="/admin/staff" className="font-semibold text-indigo-700">
                  Add your team
                </Link>{" "}
                to start assigning.
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-6">
              {groups.map((group) => (
                <div key={group.key}>
                  <div className="mb-2 flex flex-wrap items-baseline gap-x-2">
                    <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">
                      {group.title} ({group.members.length})
                    </h3>
                    <p className="text-xs text-slate-500">{group.hint}</p>
                  </div>
                  <ul className="surface-card divide-y divide-slate-100 overflow-hidden">
                    {group.members.map(renderMember)}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        <DeleteShiftControl shiftId={shift.id} eventName={shift.event_name} />
      </div>
    </main>
  );
}
