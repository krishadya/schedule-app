"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { ProfileRole } from "@/lib/auth/profile";
import { AppIcon } from "./ui/app-icon";

type NavigationItem = {
  href: string;
  label: string;
  icon: "home" | "users" | "account" | "calendar" | "schedule" | "bell" | "check";
};

const dashboardItem: NavigationItem = {
  href: "/dashboard",
  label: "Dashboard",
  icon: "home",
};
const accountItem: NavigationItem = {
  href: "/account",
  label: "Account",
  icon: "account",
};
const notificationsItem: NavigationItem = {
  href: "/notifications",
  label: "Notifications",
  icon: "bell",
};

const navigationByRole: Record<ProfileRole, NavigationItem[]> = {
  admin: [
    dashboardItem,
    { href: "/admin/shifts", label: "Shifts", icon: "calendar" },
    { href: "/admin/staff", label: "Staff", icon: "users" },
    accountItem,
  ],
  staff: [
    dashboardItem,
    { href: "/shifts", label: "Availability", icon: "check" },
    { href: "/schedule", label: "My Schedule", icon: "schedule" },
    accountItem,
  ],
};

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

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
    // Notifications live in the top bar's bell on mobile; sign out is on
    // the Account page.
    return (
      <nav aria-label="Mobile navigation" className="w-full">
        <ul className="grid grid-cols-4 items-stretch">
          {items.map((item) => {
            const active = isActive(pathname, item.href);

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-16 flex-col items-center justify-center gap-1 border-t-2 px-1 text-[11px] font-semibold transition focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-indigo-600 ${
                    active
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
        </ul>
      </nav>
    );
  }

  const sidebarItems = [
    ...items.slice(0, -1),
    notificationsItem,
    items[items.length - 1],
  ];

  return (
    <nav aria-label="Main navigation" className="mt-8 min-w-0 flex-1">
      <ul className="space-y-1.5">
        {sidebarItems.map((item) => {
          const active = isActive(pathname, item.href);

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                  active
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
