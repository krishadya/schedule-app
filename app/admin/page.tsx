import { redirect } from "next/navigation";
import Link from "next/link";

import { getAuthenticatedProfile } from "@/lib/auth/profile";

const adminActions = [
  {
    href: "/admin/shifts/new",
    title: "Create Shift",
    description: "Add an event, shift times, and staffing requirements.",
  },
  {
    href: "/admin/shifts",
    title: "View Shifts",
    description: "Review staff availability and manage shift assignments.",
  },
  {
    href: "/admin/staff",
    title: "Manage Staff",
    description: "View staff profiles and create staff accounts.",
  },
];

export default async function AdminPage() {
  const profile = await getAuthenticatedProfile();

  if (profile.role !== "admin") {
    redirect("/dashboard");
  }

  return (
    <main className="px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold text-slate-900">
            Admin Dashboard
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Manage shifts and staff availability.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {adminActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 sm:p-6"
            >
              <h2 className="font-semibold text-slate-900">{action.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {action.description}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
