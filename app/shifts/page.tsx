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
    <main className="page-shell">
      <div className="mx-auto max-w-4xl">
        <header className="page-header">
          <div>
            <p className="page-eyebrow">Availability</p>
            <h1 className="page-title">Available Shifts</h1>
            <p className="page-description">
              Review upcoming events and staffing needs.
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
                  id={`shift-${shift.id}`}
                  className="surface-card scroll-mt-32 overflow-hidden p-5 sm:p-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h2 className="text-xl font-semibold tracking-tight text-slate-950">
                      {shift.event_name}
                    </h2>
                    {initialAvailability ? (
                      <StatusBadge
                        tone={
                          initialAvailability.response === "yes"
                            ? "emerald"
                            : initialAvailability.response === "maybe"
                              ? "amber"
                              : "rose"
                        }
                      >
                        Response: {formatAvailabilityResponse(initialAvailability.response)}
                      </StatusBadge>
                    ) : (
                      <StatusBadge>No response</StatusBadge>
                    )}
                  </div>
                  <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
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
                  </div>

                  <div className="mt-5 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-100">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <AppIcon name="users" className="h-4 w-4 text-indigo-500" />
                      Staffing needed
                    </h3>
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {[...shift.shift_requirements]
                        .sort((first, second) =>
                          first.role.localeCompare(second.role),
                        )
                        .map((requirement) => (
                          <li
                            key={requirement.role}
                            className="rounded-full bg-white px-3 py-1.5 text-sm text-slate-700 ring-1 ring-slate-200"
                          >
                            {requirement.role} × {requirement.staff_needed}
                          </li>
                        ))}
                    </ul>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-slate-700">
                    <StatusBadge tone={deadlinePassed ? "slate" : "amber"}>
                      {deadlinePassed ? "Responses closed" : "Response open"}
                    </StatusBadge>
                    <span>
                      Deadline: {formatResponseDeadline(shift.response_deadline)}
                    </span>
                  </div>

                  {shift.notes ? (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
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
