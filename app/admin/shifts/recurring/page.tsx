import { redirect } from "next/navigation";

import { getAuthenticatedProfile } from "@/lib/auth/profile";
import { RecurringShiftForm } from "./recurring-shift-form";

export default async function RecurringShiftsPage() {
  const profile = await getAuthenticatedProfile();

  if (profile.role !== "admin") {
    redirect("/dashboard");
  }

  return (
    <main className="page-shell">
      <div className="mx-auto max-w-4xl">
        <header className="page-header">
          <div>
            <p className="page-eyebrow">Shift management</p>
            <h1 className="page-title">Create Recurring Shifts</h1>
            <p className="page-description">
              Enter the shared details for a shift that repeats across a date
              range, preview every occurrence, and create them together.
            </p>
          </div>
        </header>

        <RecurringShiftForm />
      </div>
    </main>
  );
}
