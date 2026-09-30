import { redirect } from "next/navigation";

import { signOut } from "./actions";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("full_name, username")
    .eq("id", data.claims.sub)
    .single();

  if (error || !profile) {
    throw new Error("Unable to load the authenticated user profile.");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-semibold text-slate-900">
          Signed in successfully
        </h1>
        <p className="text-slate-700">{profile.full_name}</p>
        <p className="text-slate-600">@{profile.username}</p>
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
