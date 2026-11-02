import { signOut } from "@/app/dashboard/actions";
import { AppIcon } from "@/components/ui/app-icon";
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

          <section className="surface-card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Sign out</h2>
              <p className="mt-0.5 text-sm text-slate-500">
                End your session on this device.
              </p>
            </div>
            <form action={signOut}>
              <button type="submit" className="btn btn-secondary w-full sm:w-auto">
                <AppIcon name="logout" className="h-4 w-4" />
                Sign Out
              </button>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
