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
            <p className="page-eyebrow">Shifts</p>
            <h1 className="page-title">Recurring Shifts</h1>
            <p className="page-description">
              Create the same shift on several days at once. Pick the dates and
              weekdays, preview the list, then save them all together.
            </p>
          </div>
        </header>

        <RecurringShiftForm />
      </div>
    </main>
  );
}
