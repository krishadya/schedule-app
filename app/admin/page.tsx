import { redirect } from "next/navigation";
import Link from "next/link";

import { getAuthenticatedProfile } from "@/lib/auth/profile";

export default async function AdminPage() {
  const profile = await getAuthenticatedProfile();

  if (profile.role !== "admin") {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-50 px-6">
      <h1 className="text-2xl font-semibold text-slate-900">
        Admin Dashboard
      </h1>
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:justify-center">
        <Link
          href="/admin/shifts"
          className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          View Shifts
        </Link>
        <Link
          href="/admin/shifts/new"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          Create Shift
        </Link>
        <Link
          href="/admin/staff"
          className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          Manage Staff
        </Link>
      </div>
    </main>
  );
}
