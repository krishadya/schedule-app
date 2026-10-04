"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { ProfileRole } from "@/lib/auth/profile";

const navigation = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/calendar", label: "Calendar" },
  { href: "/shifts", label: "Available Shifts" },
  { href: "/schedule", label: "My Schedule" },
  { href: "/account", label: "My Account" },
];

export function AuthenticatedNavigation({ role }: { role: ProfileRole }) {
  const pathname = usePathname();
  const items =
    role === "admin"
      ? [...navigation, { href: "/admin", label: "Admin" }]
      : navigation;

  return (
    <nav aria-label="Main navigation" className="min-w-0 flex-1 lg:flex-none">
      <ul className="flex flex-wrap items-center gap-1">
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
                className={`inline-flex min-h-9 items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
                  isActive
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
