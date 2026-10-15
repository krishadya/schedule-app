import Link from "next/link";

import { StatusBadge } from "@/components/ui/status-badge";
import { getAuthenticatedProfile } from "@/lib/auth/profile";
import { ChangePasswordForm } from "./change-password-form";
import { ProfileForm } from "./profile-form";

export default async function AccountPage() {
  const profile = await getAuthenticatedProfile();

  return (
    <main className="page-shell">
      <div className="mx-auto max-w-4xl">
        <header className="page-header">
          <div>
            <p className="page-eyebrow">Profile & security</p>
            <h1 className="page-title">My Account</h1>
            <p className="page-description">
              Manage your profile and account security.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="btn btn-secondary shrink-0 self-start"
          >
            Dashboard
          </Link>
        </header>

        <div className="mb-5 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
          <div>
            <p className="font-semibold text-slate-900">{profile.full_name}</p>
            <p className="text-sm text-slate-500">@{profile.username}</p>
          </div>
          <StatusBadge tone={profile.role === "admin" ? "indigo" : "slate"}>
            {profile.role === "admin" ? "Admin" : "Staff"}
          </StatusBadge>
        </div>

        <div className="space-y-6">
          <ProfileForm
            fullName={profile.full_name}
            username={profile.username}
            avatarUrl={profile.avatar_url}
          />
          <ChangePasswordForm />
        </div>
      </div>
    </main>
  );
}
