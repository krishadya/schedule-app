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
    <main className="page-shell">
      <div className="mx-auto max-w-3xl">
        <header className="mb-7">
          <p className="page-eyebrow">Shift management</p>
          <h1 className="page-title">Edit Shift</h1>
          <p className="page-description">
            Roles with assigned staff must be retained, with enough spaces for
            their assignments.
          </p>
        </header>
        <div className="surface-card p-5 sm:p-8">
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
