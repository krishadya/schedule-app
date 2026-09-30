import Link from "next/link";

import { getAuthenticatedProfile } from "@/lib/auth/profile";
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

function isAvailabilityResponse(value: string): value is AvailabilityResponse {
  return value === "yes" || value === "maybe" || value === "no";
}

export default async function ShiftsPage() {
  const profile = await getAuthenticatedProfile();

  const supabase = await createClient();
  const requestTime = new Date();
  const today = requestTime.toISOString().slice(0, 10);
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

  if (shifts.length > 0) {
    const shiftIds = shifts.map((shift) => shift.id);
    const { data: availabilityResponses, error: availabilityError } =
      await supabase
        .from("availability_responses")
        .select(
          "shift_id, response, suggested_start_time, suggested_end_time, note",
        )
        .eq("user_id", profile.id)
        .in("shift_id", shiftIds);

    if (availabilityError) {
      throw new Error("Unable to load your availability responses.");
    }

    for (const availability of availabilityResponses) {
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
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Upcoming Shifts
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Review upcoming events and staffing needs.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="self-start rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
          >
            Back to Dashboard
          </Link>
        </header>

        {shifts.length === 0 ? (
          <section className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
            <h2 className="text-lg font-medium text-slate-900">
              No upcoming shifts
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              There are no current or upcoming shifts to view right now.
            </p>
          </section>
        ) : (
          <div className="space-y-4">
            {shifts.map((shift) => {
              const initialAvailability =
                availabilityByShift.get(shift.id) ?? null;
              const deadlinePassed =
                new Date(shift.response_deadline).getTime() <= requestTimestamp;

              return (
                <article
                  key={shift.id}
                  className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
                >
                  <h2 className="text-xl font-semibold text-slate-900">
                    {shift.event_name}
                  </h2>
                  <p className="mt-2 font-medium text-slate-800">
                    {formatShiftDate(shift.date)}
                  </p>
                  <p className="mt-1 text-slate-700">
                    {formatShiftTime(shift.start_time)} –{" "}
                    {formatShiftTime(shift.end_time)}
                  </p>
                  {shift.location ? (
                    <p className="mt-1 text-slate-600">{shift.location}</p>
                  ) : null}

                  <div className="mt-5 border-t border-slate-100 pt-4">
                    <h3 className="text-sm font-semibold text-slate-900">
                      Needed:
                    </h3>
                    <ul className="mt-2 space-y-1">
                      {[...shift.shift_requirements]
                        .sort((first, second) =>
                          first.role.localeCompare(second.role),
                        )
                        .map((requirement) => (
                          <li
                            key={requirement.role}
                            className="text-sm text-slate-700"
                          >
                            {requirement.role} × {requirement.staff_needed}
                          </li>
                        ))}
                    </ul>
                  </div>

                  <p className="mt-5 text-sm font-medium text-slate-700">
                    Response deadline:{" "}
                    {formatResponseDeadline(shift.response_deadline)}
                  </p>

                  {shift.notes ? (
                    <div className="mt-4 rounded-md bg-slate-50 p-3">
                      <h3 className="text-sm font-semibold text-slate-900">
                        Notes
                      </h3>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                        {shift.notes}
                      </p>
                    </div>
                  ) : null}

                  <AvailabilityForm
                    shiftId={shift.id}
                    deadlinePassed={deadlinePassed}
                    initialAvailability={initialAvailability}
                  />
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
