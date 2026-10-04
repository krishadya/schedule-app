import Link from "next/link";

import { getAuthenticatedProfile } from "@/lib/auth/profile";

const staffActions = [
  {
    href: "/shifts",
    title: "View Available Shifts",
    description: "Review upcoming shifts and submit your availability.",
  },
  {
    href: "/schedule",
    title: "My Schedule",
    description: "See the shifts you are confirmed to work.",
  },
  {
    href: "/account",
    title: "My Account",
    description: "View your profile and change your password.",
  },
];

export default async function DashboardPage() {
  const profile = await getAuthenticatedProfile();
  const isAdmin = profile.role === "admin";
  const actions = isAdmin
    ? [
        {
          href: "/admin",
          title: "Admin Dashboard",
          description: "Manage shifts, review availability, and manage staff accounts.",
        },
        ...staffActions,
      ]
    : staffActions;

  return (
    <main className="px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8">
          <h1 className="break-words text-2xl font-semibold text-slate-900">
            Welcome, {profile.full_name}
          </h1>
          <p className="mt-1 break-words text-slate-600">@{profile.username}</p>
          {isAdmin ? (
            <p className="mt-3 inline-flex rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
              Admin
            </p>
          ) : null}
        </header>

        <section aria-labelledby="quick-actions-heading">
          <h2
            id="quick-actions-heading"
            className="mb-4 text-lg font-semibold text-slate-900"
          >
            Quick actions
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {actions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 sm:p-6"
              >
                <h3 className="font-semibold text-slate-900">{action.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {action.description}
                </p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
