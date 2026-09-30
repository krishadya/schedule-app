import Link from "next/link";

import { signOut } from "./actions";
import { getAuthenticatedProfile } from "@/lib/auth/profile";

export default async function DashboardPage() {
  const profile = await getAuthenticatedProfile();
  const isAdmin = profile.role === "admin";

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-semibold text-slate-900">
          Welcome, {profile.full_name}
        </h1>
        <p className="text-slate-600">@{profile.username}</p>
        <p className="font-medium text-slate-800">
          {isAdmin ? "Admin" : "Staff"}
        </p>
        <p className="text-slate-600">
          {isAdmin
            ? "Manage shifts and staff availability."
            : "View shifts and submit your availability."}
        </p>
        {isAdmin ? (
          <Link
            href="/admin"
            className="inline-block rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
          >
            Open Admin Dashboard
          </Link>
        ) : null}
        <form action={signOut}>
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Sign Out
          </button>
        </form>
      </div>
    </main>
  );
}
