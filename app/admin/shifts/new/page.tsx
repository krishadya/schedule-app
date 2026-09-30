import { redirect } from "next/navigation";
import { getAuthenticatedProfile } from "@/lib/auth/profile";
import { CreateShiftForm } from "./create-shift-form";

export default async function NewShiftPage() {
  const profile = await getAuthenticatedProfile();

  if (profile.role !== "admin") {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 text-2xl font-bold text-slate-900">Create Shift</h1>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <CreateShiftForm />
        </div>
      </div>
    </main>
  );
}
