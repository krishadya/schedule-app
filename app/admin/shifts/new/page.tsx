import { notFound, redirect } from "next/navigation";
import { getAuthenticatedProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { CreateShiftForm } from "./create-shift-form";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getValidDate(value: string | string[] | undefined) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined;
  }

  const [year, month, day] = value.split("-").map(Number);
  const candidate = new Date(0);
  candidate.setUTCFullYear(year, month - 1, day);
  candidate.setUTCHours(0, 0, 0, 0);

  return candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
    ? value
    : undefined;
}

export default async function NewShiftPage({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string | string[];
    duplicate?: string | string[];
  }>;
}) {
  const profile = await getAuthenticatedProfile();

  if (profile.role !== "admin") {
    redirect("/dashboard");
  }

  const { date, duplicate } = await searchParams;
  let initialDate = getValidDate(date);
  let duplicateSource:
    | {
        id: string;
        eventName: string;
        startTime: string;
        endTime: string;
        location: string;
        notes: string;
        requirements: {
          id: string;
          role: string;
          count: number;
        }[];
      }
    | null = null;

  if (duplicate !== undefined) {
    if (typeof duplicate !== "string" || !UUID_PATTERN.test(duplicate)) {
      notFound();
    }

    const supabase = await createClient();
    const { data: shift, error } = await supabase
      .from("shifts")
      .select(
        "event_name, start_time, end_time, location, notes, shift_requirements(role, staff_needed)",
      )
      .eq("id", duplicate)
      .maybeSingle();

    if (error) {
      throw new Error("Unable to load the shift for duplication.");
    }

    if (!shift) {
      notFound();
    }

    initialDate = undefined;
    duplicateSource = {
      id: duplicate,
      eventName: shift.event_name,
      startTime: shift.start_time,
      endTime: shift.end_time,
      location: shift.location ?? "",
      notes: shift.notes ?? "",
      requirements: shift.shift_requirements.map((requirement, index) => ({
        id: `duplicate-requirement-${index}`,
        role: requirement.role,
        count: requirement.staff_needed,
      })),
    };
  }

  return (
    <main className="page-shell">
      <div className="mx-auto max-w-4xl">
        <header className="page-header">
          <p className="page-eyebrow">Shift management</p>
          <h1 className="page-title">
            {duplicateSource ? "Duplicate Shift" : "Create Shift"}
          </h1>
          <p className="page-description">
            {duplicateSource
              ? "Review the copied details and choose new scheduling information."
              : "Add event details, response timing, and staffing requirements."}
          </p>
        </header>

        {duplicateSource ? (
          <p
            role="status"
            className="mb-6 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm leading-6 text-indigo-900"
          >
            Duplicating <strong>{duplicateSource.eventName}</strong>. Choose a
            new date and response deadline before creating.
          </p>
        ) : null}

        <CreateShiftForm
          initialDate={initialDate}
          cancelHref={
            duplicateSource
              ? `/admin/shifts/${duplicateSource.id}`
              : undefined
          }
          initialValues={
            duplicateSource
              ? {
                  eventName: duplicateSource.eventName,
                  date: "",
                  startTime: duplicateSource.startTime,
                  endTime: duplicateSource.endTime,
                  location: duplicateSource.location,
                  responseDeadline: "",
                  notes: duplicateSource.notes,
                  requirements: duplicateSource.requirements,
                }
              : undefined
          }
        />
      </div>
    </main>
  );
}
