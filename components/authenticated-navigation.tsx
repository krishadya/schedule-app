"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { signOut } from "@/app/dashboard/actions";
import type { ProfileRole } from "@/lib/auth/profile";
import { AppIcon } from "./ui/app-icon";

type NavigationItem = {
  href: string;
  label: string;
  icon: "home" | "users" | "account" | "calendar" | "schedule" | "bell";
};

const notificationsItem: NavigationItem = {
  href: "/notifications",
  label: "Notifications",
  icon: "bell",
};

const dashboardItem: NavigationItem = {
  href: "/dashboard",
  label: "Dashboard",
  icon: "home",
};
const accountItem: NavigationItem = {
  href: "/account",
  label: "My Account",
  icon: "account",
};

const navigationByRole: Record<ProfileRole, NavigationItem[]> = {
  admin: [
    dashboardItem,
    { href: "/admin", label: "Admin", icon: "users" },
    accountItem,
  ],
  staff: [
    dashboardItem,
    { href: "/shifts", label: "Shifts", icon: "calendar" },
    { href: "/schedule", label: "My Schedule", icon: "schedule" },
    accountItem,
  ],
};

export function AuthenticatedNavigation({
  role,
  variant,
  notificationCount = 0,
}: {
  role: ProfileRole;
  variant: "sidebar" | "mobile";
  notificationCount?: number;
}) {
  const pathname = usePathname();
  const items = navigationByRole[role];

  if (variant === "mobile") {
    return (
      <nav aria-label="Mobile navigation" className="w-full">
        <ul
          className={`grid items-stretch ${
            items.length === 4 ? "grid-cols-5" : "grid-cols-4"
          }`}
        >
          {items.map((item) => {
            const isActive =
              item.href === "/admin"
                ? pathname.startsWith("/admin")
                : pathname === item.href;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex min-h-16 flex-col items-center justify-center gap-1 border-t-2 px-1 text-[11px] font-semibold transition focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-indigo-600 ${
                    isActive
                      ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                      : "border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <AppIcon name={item.icon} className="h-5 w-5" />
                  {item.label}
                </Link>
              </li>
            );
          })}
          <li>
            <form action={signOut} className="h-full">
              <button
                type="submit"
                className="flex min-h-16 w-full flex-col items-center justify-center gap-1 border-t-2 border-transparent px-1 text-[11px] font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-indigo-600"
              >
                <AppIcon name="logout" className="h-5 w-5" />
                Sign Out
              </button>
            </form>
          </li>
        </ul>
      </nav>
    );
  }

  // The mobile bar shows a bell in the top header instead.
  const sidebarItems = [items[0], notificationsItem, ...items.slice(1)];

  return (
    <nav aria-label="Main navigation" className="mt-8 min-w-0 flex-1">
      <ul className="space-y-2">
        {sidebarItems.map((item) => {
          const isActive =
            item.href === "/admin"
              ? pathname.startsWith("/admin")
              : pathname === item.href;

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`flex min-h-12 items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-950/20"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                <AppIcon name={item.icon} className="h-5 w-5" />
                {item.label}
                {item === notificationsItem && notificationCount > 0 ? (
                  <span className="ml-auto rounded-full bg-rose-500 px-2 py-0.5 text-xs font-bold tabular-nums text-white">
                    {notificationCount}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
