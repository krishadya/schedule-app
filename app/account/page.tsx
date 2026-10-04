import Link from "next/link";

import { AppIcon } from "@/components/ui/app-icon";
import { StatusBadge } from "@/components/ui/status-badge";
import { getAuthenticatedProfile } from "@/lib/auth/profile";
import { ChangePasswordForm } from "./change-password-form";

export default async function AccountPage() {
  const profile = await getAuthenticatedProfile();

  return (
    <main className="page-shell">
      <div className="mx-auto max-w-3xl">
        <header className="page-header">
          <div>
            <p className="page-eyebrow">Profile & security</p>
            <h1 className="page-title">My Account</h1>
            <p className="page-description">
              Manage your account security.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="btn btn-secondary shrink-0 self-start"
          >
            Dashboard
          </Link>
        </header>

        <section className="surface-card mb-6 p-5 sm:p-6">
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
              <AppIcon name="account" className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <h2 className="break-words text-lg font-semibold text-slate-950">
                {profile.full_name}
              </h2>
              <p className="break-all text-sm text-slate-500">
                @{profile.username}
              </p>
            </div>
            <div className="ml-auto self-start">
              <StatusBadge tone={profile.role === "admin" ? "indigo" : "slate"}>
                {profile.role === "admin" ? "Admin" : "Staff"}
              </StatusBadge>
            </div>
          </div>
        </section>

        <ChangePasswordForm />
      </div>
    </main>
  );
}
