import Link from "next/link";

import { CalendarView } from "@/app/calendar/calendar-view";
import { getAuthenticatedProfile } from "@/lib/auth/profile";
import type {
  CalendarAvailability,
  CalendarResponse,
  CalendarShift,
} from "@/lib/calendar/types";
import { createClient } from "@/lib/supabase/server";

const APP_TIME_ZONE = "America/Los_Angeles";

function getDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));

  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
}

function isCalendarResponse(value: string): value is CalendarResponse {
  return value === "yes" || value === "maybe" || value === "no";
}

export default async function CalendarPage() {
  const profile = await getAuthenticatedProfile();
  const supabase = await createClient();
  const requestTime = new Date();
  const today = getDateKey(requestTime);
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
        })),
      availability,
      assignedRole,
      status,
    };
  });

  return (
    <main className="page-shell">
      <div className="mx-auto w-full max-w-7xl">
        <header className="page-header">
          <div>
            <p className="page-eyebrow">Your schedule at a glance</p>
            <h1 className="page-title">Calendar</h1>
            <p className="page-description">
              See confirmed assignments, availability, and response deadlines in
              one place.
            </p>
          </div>
          {profile.role === "admin" ? (
            <Link href="/admin/shifts" className="btn btn-secondary self-start">
              Manage Shifts
            </Link>
          ) : null}
        </header>

        <CalendarView
          shifts={calendarShifts}
          today={today}
          requestTimestamp={requestTimestamp}
        />
      </div>
    </main>
  );
}
