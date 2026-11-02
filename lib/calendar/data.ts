import "server-only";

import type { AuthenticatedProfile } from "@/lib/auth/profile";
import type {
  CalendarAvailability,
  CalendarResponse,
  CalendarShift,
} from "@/lib/calendar/types";
import { getAppDateKey } from "@/lib/date";
import { calculateShiftCoverage } from "@/lib/shifts/coverage";
import { createClient } from "@/lib/supabase/server";

function isCalendarResponse(value: string): value is CalendarResponse {
  return value === "yes" || value === "maybe" || value === "no";
}

export type CalendarData = {
  shifts: CalendarShift[];
  today: string;
  requestTimestamp: number;
};

export async function getCalendarData(
  profile: AuthenticatedProfile,
): Promise<CalendarData> {
  const supabase = await createClient();
  const requestTime = new Date();
  const today = getAppDateKey(requestTime);
  const requestTimestamp = requestTime.getTime();

  const { data: shifts, error: shiftsError } = await supabase
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

  if (shiftsError) {
    throw new Error("Unable to load calendar shifts.");
  }

  const shiftIds = shifts.map((shift) => shift.id);
  const availabilityByShift = new Map<string, CalendarAvailability>();
  const assignmentByShift = new Map<string, string>();
  const assignedCountsByShiftAndRole = new Map<string, number>();
  const assignedRolesByShift = new Map<string, Array<{ assigned_role: string }>>();

  if (shiftIds.length > 0) {
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
      throw new Error("Unable to load your calendar availability.");
    }

    if (assignmentResult.error) {
      throw new Error("Unable to load your calendar assignments.");
    }

    for (const availability of availabilityResult.data) {
      if (!isCalendarResponse(availability.response)) {
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
      assignmentByShift.set(assignment.shift_id, assignment.assigned_role);
    }

    if (profile.role === "admin") {
      const { data: assignments, error: assignmentsError } = await supabase
        .from("assignments")
        .select("shift_id, assigned_role")
        .in("shift_id", shiftIds);

      if (assignmentsError) {
        throw new Error("Unable to load calendar staffing progress.");
      }

      for (const assignment of assignments) {
        const roles = assignedRolesByShift.get(assignment.shift_id) ?? [];
        roles.push({ assigned_role: assignment.assigned_role });
        assignedRolesByShift.set(assignment.shift_id, roles);
        const key = `${assignment.shift_id}:${assignment.assigned_role}`;
        assignedCountsByShiftAndRole.set(
          key,
          (assignedCountsByShiftAndRole.get(key) ?? 0) + 1,
        );
      }
    }
  }

  const calendarShifts: CalendarShift[] = shifts.map((shift) => {
    const availability = availabilityByShift.get(shift.id) ?? null;
    const assignedRole = assignmentByShift.get(shift.id) ?? null;
    const status = assignedRole
      ? "assigned"
      : availability?.response === "yes"
        ? "available"
        : availability?.response === "maybe"
          ? "maybe"
          : availability?.response === "no"
            ? "unavailable"
            : "needs-response";

    return {
      id: shift.id,
      eventName: shift.event_name,
      date: shift.date,
      startTime: shift.start_time,
      endTime: shift.end_time,
      location: shift.location,
      notes: shift.notes,
      responseDeadline: shift.response_deadline,
      requirements: [...shift.shift_requirements]
        .sort((first, second) => first.role.localeCompare(second.role))
        .map((requirement) => ({
          role: requirement.role,
          staffNeeded: requirement.staff_needed,
          assignedCount:
            profile.role === "admin"
              ? (assignedCountsByShiftAndRole.get(
                  `${shift.id}:${requirement.role}`,
                ) ?? 0)
              : null,
        })),
      availability,
      assignedRole,
      status,
      coverage:
        profile.role === "admin"
          ? (({ status, filled, required, open }) => ({
              status,
              filled,
              required,
              open,
            }))(
              calculateShiftCoverage(
                shift.shift_requirements,
                assignedRolesByShift.get(shift.id) ?? [],
              ),
            )
          : null,
    };
  });

  return {
    shifts: calendarShifts,
    today,
    requestTimestamp,
  };
}
