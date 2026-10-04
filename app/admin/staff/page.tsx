import Link from "next/link";
import { redirect } from "next/navigation";

import { getAuthenticatedProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { CreateStaffForm } from "./create-staff-form";
import { ResetPasswordControl } from "./reset-password-control";

export default async function AdminStaffPage() {
  const authenticatedProfile = await getAuthenticatedProfile();

  if (authenticatedProfile.role !== "admin") {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const { data: staff, error } = await supabase
    .from("profiles")
    .select("id, full_name, username, role")
    .eq("role", "staff")
    .order("full_name", { ascending: true })
    .order("username", { ascending: true });

  if (error) {
    throw new Error("Unable to load staff profiles.");
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Manage Staff
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Create staff accounts and review the current staff roster.
            </p>
          </div>
          <Link
            href="/admin"
            className="self-start rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
          >
            Back to Admin Dashboard
          </Link>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start">
          <CreateStaffForm />

          <section>
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Staff Accounts
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Existing staff profiles.
                </p>
              </div>
              <p className="text-sm text-slate-600">
                {staff.length} {staff.length === 1 ? "account" : "accounts"}
              </p>
            </div>

            {staff.length === 0 ? (
              <div className="mt-4 rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                <p className="text-sm text-slate-600">
                  No staff accounts have been created yet.
                </p>
              </div>
            ) : (
              <ul className="mt-4 space-y-3">
                {staff.map((staffMember) => (
                  <li
                    key={staffMember.id}
                    className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">
                        {staffMember.full_name}
                      </p>
                      <p className="break-all text-sm text-slate-500">
                        @{staffMember.username}
                      </p>
                      <span className="mt-2 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                        Staff
                      </span>
                    </div>
                    {staffMember.role === "staff" ? (
                      <ResetPasswordControl
                        staffId={staffMember.id}
                        fullName={staffMember.full_name}
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
