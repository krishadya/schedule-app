import "server-only";

import Link from "next/link";

import { signOut } from "@/app/dashboard/actions";
import type { AuthenticatedProfile } from "@/lib/auth/profile";
import { AuthenticatedNavigation } from "./authenticated-navigation";
import { AppLogo } from "./ui/app-logo";
import { AppIcon } from "./ui/app-icon";
import { UserAvatar } from "./ui/user-avatar";

export function AuthenticatedHeader({
  profile,
}: {
  profile: AuthenticatedProfile;
}) {
  return (
    <div className="contents">
      <aside className="hidden h-screen flex-col bg-slate-950 px-4 py-6 lg:sticky lg:top-0 lg:flex">
        <Link
          href="/dashboard"
          aria-label="Schedule App dashboard"
          className="inline-flex rounded-lg px-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <AppLogo compact inverse subtitle />
        </Link>

        <AuthenticatedNavigation role={profile.role} variant="sidebar" />

        <Link
          href="/account"
          className="mt-6 flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3 text-white transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <UserAvatar
            name={profile.full_name}
            src={profile.avatar_url}
            size="sm"
          />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">
              {profile.full_name}
            </span>
            <span className="block truncate text-xs text-slate-400">
              @{profile.username}
            </span>
          </span>
        </Link>

        <form action={signOut} className="mt-2">
          <button
            type="submit"
            className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3.5 text-sm font-semibold text-slate-400 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <AppIcon name="logout" className="h-5 w-5" />
            Sign Out
          </button>
        </form>
      </aside>

      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <Link
          href="/dashboard"
          aria-label="Schedule App dashboard"
          className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          <AppLogo compact />
        </Link>
        <Link
          href="/account"
          aria-label="Open My Account"
          className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          <UserAvatar
            name={profile.full_name}
            src={profile.avatar_url}
            size="sm"
          />
        </Link>
      </header>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden">
        <AuthenticatedNavigation role={profile.role} variant="mobile" />
      </div>
    </div>
  );
}
