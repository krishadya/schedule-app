import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppIcon } from "@/components/ui/app-icon";
import { MetricCard } from "@/components/ui/metric-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { getAuthenticatedProfile } from "@/lib/auth/profile";
import {
  findAssignmentConflicts,
  type ConflictingShift,
} from "@/lib/shifts/conflicts";
import { createClient } from "@/lib/supabase/server";
import { DeleteShiftControl } from "./delete-shift-control";
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
});

const deadlineTimeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
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

  const [profilesResult, responsesResult, assignmentsResult, sameDayResult] =
    await Promise.all([
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
      // Other shifts on the same day, to flag staff already booked then.
      supabase
        .from("shifts")
        .select(
          "id, event_name, date, start_time, end_time, assignments ( user_id, assigned_role )",
        )
        .eq("date", shift.date)
        .neq("id", shift.id),
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

  if (sameDayResult.error) {
    throw new Error("Unable to check for scheduling conflicts.");
  }

  const conflictsByUser = findAssignmentConflicts(shift, sameDayResult.data);

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

  const counts: Record<AvailabilityStatus, number> = {
    yes: 0,
    maybe: 0,
    no: 0,
    no_response: 0,
  };

  for (const member of staff) {
    counts[getStatus(member)] += 1;
  }

  return (
    <main className="page-shell">
      <div className="page-container">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/admin/shifts"
            className="btn btn-ghost px-0"
          >
            ← Back to Shifts
          </Link>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/admin/shifts/new?duplicate=${shift.id}`}
              className="btn btn-secondary"
            >
              Duplicate Shift
            </Link>
            <Link
              href={`/admin/shifts/${shift.id}/edit`}
              className="btn btn-secondary"
            >
              Edit Shift
            </Link>
          </div>
        </div>

        <section className="surface-card overflow-hidden p-5 sm:p-7">
          <div className="mb-5 flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
              <AppIcon name="calendar" />
            </span>
            <div>
              <p className="page-eyebrow">Shift details</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
                {shift.event_name}
              </h1>
            </div>
          </div>
          <div className="grid gap-4 text-sm sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="flex items-center gap-2 font-semibold text-slate-900">
                <AppIcon name="clock" className="h-4 w-4 text-indigo-500" />
                Date and time
              </p>
              <p className="mt-2 text-slate-600">{formatDate(shift.date)}</p>
              <p className="mt-0.5 text-slate-600">
                {formatTime(shift.start_time)} – {formatTime(shift.end_time)}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="flex items-center gap-2 font-semibold text-slate-900">
                <AppIcon name="location" className="h-4 w-4 text-indigo-500" />
                Location
              </p>
              <p className="mt-2 text-slate-600">
                {shift.location || "Not specified"}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="font-semibold text-slate-900">Response deadline</p>
              <p className="mt-2 text-slate-600">
                {formatDeadline(shift.response_deadline)}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="flex items-center gap-2 font-semibold text-slate-900">
                <AppIcon name="users" className="h-4 w-4 text-indigo-500" />
                Staff requirements
              </p>
              <ul className="mt-2 flex flex-wrap gap-2 text-slate-600">
                {[...shift.shift_requirements]
                  .sort((first, second) =>
                    first.role.localeCompare(second.role),
                  )
                  .map((requirement) => (
                    <li
                      key={requirement.role}
                      className="rounded-full bg-white px-2.5 py-1 ring-1 ring-slate-200"
                    >
                      {requirement.role} × {requirement.staff_needed}
                    </li>
                  ))}
              </ul>
            </div>
          </div>

          <div className="mt-5 border-t border-slate-100 pt-4">
            <h2 className="text-sm font-semibold text-slate-900">Notes</h2>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
              {shift.notes || "No notes."}
            </p>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="section-title">Assignments</h2>
          <p className="mt-1 text-sm text-slate-600">
            Current staffing against each required role.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {assignmentRoles.map((role) => (
              <div
                key={role.role}
                className="surface-card p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold text-slate-900">{role.role}</h3>
                  {role.assignedCount >= role.staffNeeded ? (
                    <StatusBadge tone="emerald">Full</StatusBadge>
                  ) : null}
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-slate-500">Needed</dt>
                    <dd className="font-semibold text-slate-900">
                      {role.staffNeeded}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Assigned</dt>
                    <dd className="font-semibold text-slate-900">
                      {role.assignedCount}
                    </dd>
                  </div>
                </dl>
                <div
                  role="progressbar"
                  aria-label={`${role.role} staffing progress`}
                  aria-valuemin={0}
                  aria-valuemax={role.staffNeeded}
                  aria-valuenow={Math.min(role.assignedCount, role.staffNeeded)}
                  className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100"
                >
                  <div
                    className="h-full rounded-full bg-indigo-500"
                    style={{
                      width: `${Math.min(100, (role.assignedCount / role.staffNeeded) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="section-title">
                Staff Availability
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Responses from all staff members.
              </p>
            </div>
            <p className="text-sm text-slate-600">
              {staff.length} {staff.length === 1 ? "staff member" : "staff members"}
            </p>
          </div>

          <div
            aria-label="Availability response summary"
            className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"
          >
            {(
              ["yes", "maybe", "no", "no_response"] as AvailabilityStatus[]
            ).map((status) => (
              <MetricCard
                key={status}
                label={getStatusLabel(status)}
                value={counts[status]}
                tone={getStatusTone(status)}
              />
            ))}
          </div>

          {staff.length === 0 ? (
            <div className="empty-state mt-4 p-8">
              <p className="text-sm text-slate-600">
                No staff profiles are available yet.
              </p>
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {staff.map((member) => {
                const status = getStatus(member);

                return (
                  <li
                    key={member.id}
                    className="surface-card p-4 sm:p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {member.fullName}
                        </p>
                        <p className="text-sm text-slate-500">
                          @{member.username}
                        </p>
                      </div>
                      <StatusBadge tone={getStatusTone(status)}>
                        {getStatusLabel(status)}
                      </StatusBadge>
                    </div>

                    {member.response?.status === "maybe" &&
                    (member.response.suggestedStartTime ||
                      member.response.suggestedEndTime) ? (
                      <div className="mt-3 space-y-1 text-sm text-slate-600">
                        {member.response.suggestedStartTime ? (
                          <p>
                            Available from:{" "}
                            {formatTime(member.response.suggestedStartTime)}
                          </p>
                        ) : null}
                        {member.response.suggestedEndTime ? (
                          <p>
                            Available until:{" "}
                            {formatTime(member.response.suggestedEndTime)}
                          </p>
                        ) : null}
                      </div>
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
                              {formatTime(conflict.endTime)} ·{" "}
                              {conflict.assignedRole}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {member.response?.note ? (
                      <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">
                        <span className="font-medium">Note:</span>{" "}
                        {member.response.note}
                      </p>
                    ) : null}

                    <StaffAssignmentControl
                      shiftId={shift.id}
                      userId={member.id}
                      assignedRole={member.assignedRole}
                      roles={assignmentRoles}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <DeleteShiftControl shiftId={shift.id} eventName={shift.event_name} />
      </div>
    </main>
  );
}
