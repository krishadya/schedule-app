"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { signOut } from "@/app/dashboard/actions";
import type { ProfileRole } from "@/lib/auth/profile";
import { AppIcon } from "./ui/app-icon";

const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: "home" as const },
  { href: "/account", label: "My Account", icon: "account" as const },
];

export function AuthenticatedNavigation({
  role,
  variant,
}: {
  role: ProfileRole;
  variant: "sidebar" | "mobile";
}) {
  const pathname = usePathname();
  const items =
    role === "admin"
      ? [
          navigation[0],
          { href: "/admin", label: "Admin", icon: "users" as const },
          navigation[1],
        ]
      : navigation;

  if (variant === "mobile") {
    return (
      <nav aria-label="Mobile navigation" className="w-full">
        <ul
          className={`grid items-stretch ${
            role === "admin" ? "grid-cols-4" : "grid-cols-3"
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

  return (
    <nav aria-label="Main navigation" className="mt-8 min-w-0 flex-1">
      <ul className="space-y-2">
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
                className={`flex min-h-12 items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-950/20"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
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
