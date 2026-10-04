import { redirect } from "next/navigation";
import Link from "next/link";
import { AppIcon } from "@/components/ui/app-icon";
import { getAuthenticatedProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
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

export default async function AdminShiftsPage() {
  const profile = await getAuthenticatedProfile();

  if (profile.role !== "admin") {
    redirect("/dashboard");
  }

  const supabase = await createClient();

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
      shift_requirements (
        role,
        staff_needed
      )
    `,
    )
    .order("date", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) {
    throw new Error("Unable to load shifts.");
  }

  return (
    <main className="page-shell">
      <div className="page-container">
        <header className="page-header">
          <div>
            <p className="page-eyebrow">Shift management</p>
            <h1 className="page-title">Shifts</h1>
            <p className="page-description">
              Review event staffing, responses, and assignments.
            </p>
          </div>
          <Link
            href="/admin/shifts/new"
            className="btn btn-primary self-start"
          >
            <AppIcon name="plus" className="h-4 w-4" />
            Create Shift
          </Link>
        </header>

        {shifts.length === 0 ? (
          <div className="empty-state">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
              <AppIcon name="calendar" className="h-6 w-6" />
            </span>
            <h2 className="mt-4 text-lg font-semibold text-slate-900">
              No shifts found
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Get started by creating a new shift for an upcoming event.
            </p>
            <Link
              href="/admin/shifts/new"
              className="btn btn-primary mt-6"
            >
              Create your first shift
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {shifts.map((shift) => (
              <article
                key={shift.id}
                className="surface-card p-5 sm:p-6"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h2 className="break-words text-xl font-semibold tracking-tight text-slate-950">
                      {shift.event_name}
                    </h2>
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
                  </div>
                  <Link
                    href={`/admin/shifts/${shift.id}`}
                    className="btn btn-secondary self-start"
                  >
                    View Responses
                  </Link>
                </div>
                <div className="mt-5 border-t border-slate-100 pt-4">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <AppIcon name="users" className="h-4 w-4 text-indigo-500" />
                    Staffing requirements
                  </h3>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {shift.shift_requirements?.map(
                      (req: { role: string; staff_needed: number }) => (
                        <li
                          key={req.role}
                          className="rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-700"
                        >
                          {req.role} × {req.staff_needed}
                        </li>
                      ),
                    )}
                  </ul>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
