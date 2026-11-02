import Link from "next/link";

import { AppIcon } from "@/components/ui/app-icon";
import { getAuthenticatedProfile } from "@/lib/auth/profile";
import type {
  NotificationItem,
  NotificationTone,
} from "@/lib/notifications/build";
import { getNotifications } from "@/lib/notifications/data";

const toneClasses: Record<NotificationTone, string> = {
  amber: "bg-amber-500",
  indigo: "bg-indigo-500",
  emerald: "bg-emerald-500",
  slate: "bg-slate-400",
};

function NotificationList({
  title,
  items,
}: {
  title: string;
  items: NotificationItem[];
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="mb-8">
      <h2 className="section-title">{title}</h2>
      <ul className="surface-card mt-3 divide-y divide-slate-100 overflow-hidden">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={item.href}
              className="flex items-center gap-3 p-4 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-600 sm:px-5"
            >
              <span
                aria-hidden="true"
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${toneClasses[item.tone]}`}
              />
              <span className="min-w-0 flex-1">
                <span className="block break-words font-semibold text-slate-900">
                  {item.title}
                </span>
                <span className="mt-0.5 block text-sm text-slate-600">
                  {item.detail}
                </span>
              </span>
              <AppIcon name="arrow" className="h-4 w-4 shrink-0 text-slate-400" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function NotificationsPage() {
  const profile = await getAuthenticatedProfile();
  const { items } = await getNotifications(profile.id, profile.role);
  const actionItems = items.filter((item) => item.actionable);
  const updateItems = items.filter((item) => !item.actionable);
  const isAdmin = profile.role === "admin";

  return (
    <main className="page-shell">
      <div className="mx-auto max-w-3xl">
        <header className="page-header">
          <div>
            <p className="page-eyebrow">Stay on top of things</p>
            <h1 className="page-title">Notifications</h1>
            <p className="page-description">
              {isAdmin
                ? "Shifts that need staffing decisions and recent staff responses."
                : "Shifts waiting for your response and updates to your schedule."}
            </p>
          </div>
        </header>

        {items.length === 0 ? (
          <div className="empty-state">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <AppIcon name="check" className="h-6 w-6" />
            </span>
            <h2 className="mt-4 text-lg font-semibold text-slate-900">
              You&apos;re all caught up
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              {isAdmin
                ? "No shifts need staffing attention right now."
                : "Nothing needs your response right now."}
            </p>
          </div>
        ) : (
          <>
            <NotificationList title="Needs your attention" items={actionItems} />
            <NotificationList title="Updates" items={updateItems} />
          </>
        )}
      </div>
    </main>
  );
}
