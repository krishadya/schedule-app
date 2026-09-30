import Link from "next/link";

import { getAuthenticatedProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

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
  const today = new Date().toISOString().slice(0, 10);
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
      .gte("date", today);

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

  schedule.sort((first, second) => {
    const dateDifference = first.shift.date.localeCompare(second.shift.date);

    if (dateDifference !== 0) {
      return dateDifference;
    }

    return first.shift.start_time.localeCompare(second.shift.start_time);
  });

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              My Schedule
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Your confirmed upcoming shifts.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="self-start rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
          >
            Back to Dashboard
          </Link>
        </header>

        {schedule.length === 0 ? (
          <section className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
            <h2 className="text-lg font-medium text-slate-900">
              No confirmed shifts
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              You do not have any confirmed shifts yet.
            </p>
          </section>
        ) : (
          <div className="space-y-4">
            {schedule.map((assignment) => (
              <article
                key={assignment.id}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
              >
                <h2 className="text-xl font-semibold text-slate-900">
                  {assignment.shift.event_name}
                </h2>
                <p className="mt-2 font-medium text-slate-800">
                  {formatDate(assignment.shift.date)}
                </p>
                <p className="mt-1 text-slate-700">
                  {formatTime(assignment.shift.start_time)} –{" "}
                  {formatTime(assignment.shift.end_time)}
                </p>
                {assignment.shift.location ? (
                  <p className="mt-1 text-slate-600">
                    {assignment.shift.location}
                  </p>
                ) : null}

                <div className="mt-5 border-t border-slate-100 pt-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Assigned role
                  </p>
                  <p className="mt-1 font-semibold text-slate-900">
                    {assignment.assignedRole}
                  </p>
                </div>

                {assignment.shift.notes ? (
                  <div className="mt-4 rounded-md bg-slate-50 p-3">
                    <h3 className="text-sm font-semibold text-slate-900">
                      Notes
                    </h3>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                      {assignment.shift.notes}
                    </p>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
