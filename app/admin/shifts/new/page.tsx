import { redirect } from "next/navigation";
import { getAuthenticatedProfile } from "@/lib/auth/profile";
import { CreateShiftForm } from "./create-shift-form";

export default async function NewShiftPage() {
  const profile = await getAuthenticatedProfile();

  if (profile.role !== "admin") {
    redirect("/dashboard");
  }

  return (
    <main className="page-shell">
      <div className="mx-auto max-w-3xl">
        <header className="mb-7">
          <p className="page-eyebrow">Shift management</p>
          <h1 className="page-title">Create Shift</h1>
          <p className="page-description">
            Add event details, response timing, and staffing requirements.
          </p>
        </header>
        <div className="surface-card p-5 sm:p-8">
          <CreateShiftForm />
        </div>
      </div>
    </main>
  );
}
