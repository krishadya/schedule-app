import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthenticatedProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

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
    <main className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">Shifts</h1>
          <Link
            href="/admin/shifts/new"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            Create Shift
          </Link>
        </div>

        {shifts.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <h2 className="text-lg font-medium text-slate-900">
              No shifts found
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Get started by creating a new shift for an upcoming event.
            </p>
            <Link
              href="/admin/shifts/new"
              className="mt-6 inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            >
              Create your first shift
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {shifts.map((shift) => (
              <div
                key={shift.id}
                className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">
                      {shift.event_name}
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      {shift.date} • {shift.start_time.slice(0, 5)} –{" "}
                      {shift.end_time.slice(0, 5)}
                      {shift.location ? ` • ${shift.location}` : ""}
                    </p>
                  </div>
                </div>
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <h3 className="text-sm font-medium text-slate-900">
                    Requirements
                  </h3>
                  <ul className="mt-2 space-y-1">
                    {shift.shift_requirements?.map(
                      (req: { role: string; staff_needed: number }) => (
                        <li key={req.role} className="text-sm text-slate-600">
                          {req.role} × {req.staff_needed}
                        </li>
                      ),
                    )}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
