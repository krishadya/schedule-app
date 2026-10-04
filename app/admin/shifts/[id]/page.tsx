import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getAuthenticatedProfile } from "@/lib/auth/profile";
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

function getStatusClasses(status: AvailabilityStatus) {
  if (status === "yes") {
    return "bg-emerald-100 text-emerald-800";
  }

  if (status === "maybe") {
    return "bg-amber-100 text-amber-800";
  }

  if (status === "no") {
    return "bg-rose-100 text-rose-800";
  }

  return "bg-slate-100 text-slate-600";
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

  const [profilesResult, responsesResult, assignmentsResult] =
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
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/admin/shifts"
            className="text-sm font-semibold text-slate-700 hover:text-slate-900"
          >
            ← Back to Shifts
          </Link>
          <Link
            href={`/admin/shifts/${shift.id}/edit`}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
          >
            Edit Shift
          </Link>
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h1 className="text-2xl font-semibold text-slate-900">
            {shift.event_name}
          </h1>
          <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <p className="font-medium text-slate-900">Date and time</p>
              <p className="mt-1 text-slate-600">{formatDate(shift.date)}</p>
              <p className="text-slate-600">
                {formatTime(shift.start_time)} – {formatTime(shift.end_time)}
              </p>
            </div>
            <div>
              <p className="font-medium text-slate-900">Location</p>
              <p className="mt-1 text-slate-600">
                {shift.location || "Not specified"}
              </p>
            </div>
            <div>
              <p className="font-medium text-slate-900">Response deadline</p>
              <p className="mt-1 text-slate-600">
                {formatDeadline(shift.response_deadline)}
              </p>
            </div>
            <div>
              <p className="font-medium text-slate-900">Staff requirements</p>
              <ul className="mt-1 space-y-1 text-slate-600">
                {[...shift.shift_requirements]
                  .sort((first, second) =>
                    first.role.localeCompare(second.role),
                  )
                  .map((requirement) => (
                    <li key={requirement.role}>
                      {requirement.role} × {requirement.staff_needed}
                    </li>
                  ))}
              </ul>
            </div>
          </div>

          <div className="mt-5 border-t border-slate-100 pt-4">
            <h2 className="text-sm font-medium text-slate-900">Notes</h2>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
              {shift.notes || "No notes."}
            </p>
          </div>
        </section>

        <section className="mt-6">
          <h2 className="text-xl font-semibold text-slate-900">Assignments</h2>
          <p className="mt-1 text-sm text-slate-600">
            Current staffing against each required role.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {assignmentRoles.map((role) => (
              <div
                key={role.role}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold text-slate-900">{role.role}</h3>
                  {role.assignedCount >= role.staffNeeded ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">
                      Full
                    </span>
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
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
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

          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(
              ["yes", "maybe", "no", "no_response"] as AvailabilityStatus[]
            ).map((status) => (
              <div
                key={status}
                className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
              >
                <dt className="text-xs font-medium text-slate-600">
                  {getStatusLabel(status)}
                </dt>
                <dd className="mt-1 text-2xl font-semibold text-slate-900">
                  {counts[status]}
                </dd>
              </div>
            ))}
          </dl>

          {staff.length === 0 ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
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
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
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
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(status)}`}
                      >
                        {getStatusLabel(status)}
                      </span>
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
