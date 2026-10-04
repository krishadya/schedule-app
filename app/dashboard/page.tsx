import { ActionCard } from "@/components/ui/action-card";
import { AppIcon } from "@/components/ui/app-icon";
import { StatusBadge } from "@/components/ui/status-badge";
import { getAuthenticatedProfile } from "@/lib/auth/profile";

const staffActions = [
  {
    href: "/calendar",
    title: "Calendar",
    description: "See assignments, availability, and upcoming shifts together.",
    icon: "calendar" as const,
  },
  {
    href: "/shifts",
    title: "Available Shifts",
    description: "Review upcoming shifts and submit your availability.",
    icon: "calendar" as const,
  },
  {
    href: "/schedule",
    title: "My Schedule",
    description: "See the shifts you are confirmed to work.",
    icon: "schedule" as const,
  },
  {
    href: "/account",
    title: "My Account",
    description: "View your profile and change your password.",
    icon: "account" as const,
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
          icon: "shield" as const,
        },
        ...staffActions,
      ]
    : staffActions;

  return (
    <main className="page-shell">
      <div className="page-container">
        <header className="relative mb-8 overflow-hidden rounded-3xl bg-slate-950 px-5 py-7 text-white shadow-lg shadow-slate-200 sm:px-8 sm:py-9">
          <div className="absolute -right-12 -top-16 h-52 w-52 rounded-full bg-indigo-500/25 blur-2xl" />
          <div className="relative">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-indigo-200 ring-1 ring-white/15">
                <AppIcon name={isAdmin ? "shield" : "account"} />
              </span>
              <StatusBadge tone={isAdmin ? "indigo" : "slate"}>
                {isAdmin ? "Admin" : "Staff"}
              </StatusBadge>
            </div>
            <p className="text-sm font-medium text-indigo-200">Welcome back</p>
            <h1 className="mt-1 break-words text-2xl font-bold tracking-tight sm:text-3xl">
              {profile.full_name}
            </h1>
            <p className="mt-2 break-all text-sm text-slate-300">
              @{profile.username}
            </p>
          </div>
        </header>

        <section aria-labelledby="quick-actions-heading">
          <h2
            id="quick-actions-heading"
            className="section-title mb-4"
          >
            Quick actions
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {actions.map((action) => (
              <ActionCard
                key={action.href}
                href={action.href}
                title={action.title}
                description={action.description}
                icon={action.icon}
              />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
