import { notFound, redirect } from "next/navigation";

import { getAuthenticatedProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { ShiftForm } from "../../shift-form";
import { editShift } from "../shift-actions";

export default async function EditShiftPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await getAuthenticatedProfile();
  if (profile.role !== "admin") redirect("/dashboard");
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();

  const supabase = await createClient();
  const { data: shift, error } = await supabase.from("shifts")
    .select("id, event_name, date, start_time, end_time, location, notes, response_deadline, updated_at, shift_requirements(id, role, staff_needed)")
    .eq("id", id).maybeSingle();
  if (error) throw new Error("Unable to load the shift for editing.");
  if (!shift) notFound();

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold text-slate-900">Edit Shift</h1>
        <p className="mb-6 mt-2 text-sm text-slate-600">
          Roles with assigned staff must be retained, with enough spaces for their assignments.
        </p>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <ShiftForm
            action={editShift.bind(null, shift.id, shift.updated_at)}
            cancelHref={`/admin/shifts/${shift.id}`}
            initialValues={{
              eventName: shift.event_name, date: shift.date,
              startTime: shift.start_time, endTime: shift.end_time,
              location: shift.location ?? "", notes: shift.notes ?? "",
              responseDeadline: shift.response_deadline,
              requirements: shift.shift_requirements.map((row) => ({
                id: row.id, role: row.role, count: row.staff_needed,
              })),
            }}
          />
        </div>
      </div>
    </main>
  );
}
