import { redirect } from "next/navigation";

import { ActionCard } from "@/components/ui/action-card";
import { getAuthenticatedProfile } from "@/lib/auth/profile";

const adminActions = [
  {
    href: "/admin/shifts/new",
    title: "Create Shift",
    description: "Add an event, shift times, and staffing requirements.",
    icon: "plus" as const,
  },
  {
    href: "/admin/shifts",
    title: "View Shifts",
    description: "Review staff availability and manage shift assignments.",
    icon: "calendar" as const,
  },
  {
    href: "/admin/staff",
    title: "Manage Staff",
    description: "View staff profiles and create staff accounts.",
    icon: "users" as const,
  },
];

export default async function AdminPage() {
  const profile = await getAuthenticatedProfile();

  if (profile.role !== "admin") {
    redirect("/dashboard");
  }

  return (
    <main className="page-shell">
      <div className="page-container">
        <header className="page-header">
          <div>
            <p className="page-eyebrow">Administration</p>
            <h1 className="page-title">Admin Dashboard</h1>
            <p className="page-description">
              Create and manage shifts, staffing, and staff accounts.
            </p>
          </div>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {adminActions.map((action) => (
            <ActionCard
              key={action.href}
              href={action.href}
              title={action.title}
              description={action.description}
              icon={action.icon}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
