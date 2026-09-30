import { redirect } from "next/navigation";

import { getAuthenticatedProfile } from "@/lib/auth/profile";

export default async function AdminPage() {
  const profile = await getAuthenticatedProfile();

  if (profile.role !== "admin") {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <h1 className="text-2xl font-semibold text-slate-900">
        Admin Dashboard
      </h1>
    </main>
  );
}
