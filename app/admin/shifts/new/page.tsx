import { redirect } from "next/navigation";
import { getAuthenticatedProfile } from "@/lib/auth/profile";
import { CreateShiftForm } from "./create-shift-form";

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
  searchParams: Promise<{ date?: string | string[] }>;
}) {
  const profile = await getAuthenticatedProfile();

  if (profile.role !== "admin") {
    redirect("/dashboard");
  }

  const { date } = await searchParams;
  const initialDate = getValidDate(date);

  return (
    <main className="page-shell">
      <div className="mx-auto max-w-4xl">
        <header className="page-header">
          <p className="page-eyebrow">Shift management</p>
          <h1 className="page-title">Create Shift</h1>
          <p className="page-description">
            Add event details, response timing, and staffing requirements.
          </p>
        </header>
        <CreateShiftForm initialDate={initialDate} />
      </div>
    </main>
  );
}
