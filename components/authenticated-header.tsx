import "server-only";

import Link from "next/link";

import { signOut } from "@/app/dashboard/actions";
import type { ProfileRole } from "@/lib/auth/profile";

const navigation = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/shifts", label: "Available Shifts" },
  { href: "/schedule", label: "My Schedule" },
  { href: "/account", label: "My Account" },
];

const linkClassName =
  "inline-block rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900";

export function AuthenticatedHeader({ role }: { role: ProfileRole }) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <Link
          href="/dashboard"
          className="self-start rounded text-lg font-semibold tracking-tight text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          Vernon Schedule System
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <nav aria-label="Main navigation">
            <ul className="flex flex-wrap items-center gap-1">
              {navigation.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className={linkClassName}>
                    {item.label}
                  </Link>
                </li>
              ))}
              {role === "admin" ? (
                <li>
                  <Link href="/admin" className={linkClassName}>
                    Admin
                  </Link>
                </li>
              ) : null}
            </ul>
          </nav>

          <form action={signOut}>
            <button
              type="submit"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            >
              Sign Out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
