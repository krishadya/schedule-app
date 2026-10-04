import Link from "next/link";

import { getAuthenticatedProfile } from "@/lib/auth/profile";
import { ChangePasswordForm } from "./change-password-form";

export default async function AccountPage() {
  const profile = await getAuthenticatedProfile();

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-xl">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              My Account
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Manage your account security.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="shrink-0 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
          >
            Dashboard
          </Link>
        </header>

        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            {profile.full_name}
          </h2>
          <p className="mt-1 text-sm text-slate-600">@{profile.username}</p>
          <p className="mt-3 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {profile.role === "admin" ? "Admin" : "Staff"}
          </p>
        </section>

        <ChangePasswordForm />
      </div>
    </main>
  );
}
