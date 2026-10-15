import Link from "next/link";
import { redirect } from "next/navigation";

import { AppIcon } from "@/components/ui/app-icon";
import { StatusBadge } from "@/components/ui/status-badge";
import { UserAvatar } from "@/components/ui/user-avatar";
import { getAuthenticatedProfile } from "@/lib/auth/profile";
import { getAvatarUrl } from "@/lib/profile/avatar";
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
    .select("*")
    .eq("role", "staff")
    .order("full_name", { ascending: true })
    .order("username", { ascending: true });

  if (error) {
    throw new Error("Unable to load staff profiles.");
  }

  return (
    <main className="page-shell">
      <div className="page-container">
        <header className="page-header">
          <div>
            <p className="page-eyebrow">Staff administration</p>
            <h1 className="page-title">Manage Staff</h1>
            <p className="page-description">
              Create staff accounts and review the current staff roster.
            </p>
          </div>
          <Link
            href="/admin"
            className="btn btn-secondary self-start"
          >
            Back to Admin Dashboard
          </Link>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start">
          <CreateStaffForm />

          <section>
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="section-title">
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
              <div className="empty-state mt-4 p-8">
                <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                  <AppIcon name="users" />
                </span>
                <p className="mt-3 text-sm text-slate-600">
                  No staff accounts have been created yet.
                </p>
              </div>
            ) : (
              <ul className="surface-card mt-4 divide-y divide-slate-200 overflow-hidden">
                {staff.map((staffMember) => (
                  <li
                    key={staffMember.id}
                    className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <UserAvatar
                        name={staffMember.full_name}
                        src={getAvatarUrl(
                          typeof staffMember.avatar_path === "string"
                            ? staffMember.avatar_path
                            : null,
                        )}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-slate-900">
                            {staffMember.full_name}
                          </p>
                          <StatusBadge>Staff</StatusBadge>
                        </div>
                        <p className="break-all text-sm text-slate-500">
                          @{staffMember.username}
                        </p>
                      </div>
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
