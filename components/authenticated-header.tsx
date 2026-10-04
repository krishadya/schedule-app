import "server-only";

import Link from "next/link";

import { signOut } from "@/app/dashboard/actions";
import type { ProfileRole } from "@/lib/auth/profile";
import { AuthenticatedNavigation } from "./authenticated-navigation";
import { AppIcon } from "./ui/app-icon";

export function AuthenticatedHeader({ role }: { role: ProfileRole }) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/90 bg-white/95 shadow-sm backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <Link
          href="/dashboard"
          className="group inline-flex self-start items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-200 transition-colors group-hover:bg-indigo-700">
            <AppIcon name="calendar" className="h-5 w-5" />
          </span>
          <span className="text-lg font-bold tracking-tight text-slate-950">
            Schedule App
          </span>
        </Link>

        <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
          <AuthenticatedNavigation role={role} />

          <form action={signOut}>
            <button
              type="submit"
              className="btn btn-secondary min-h-9 px-3 py-1.5"
            >
              Sign Out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
