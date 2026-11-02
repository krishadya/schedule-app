import { redirect } from "next/navigation";

import { AppIcon } from "@/components/ui/app-icon";
import { StatusBadge } from "@/components/ui/status-badge";
import { UserAvatar } from "@/components/ui/user-avatar";
import { getAuthenticatedProfile } from "@/lib/auth/profile";
import { getAppDateKey } from "@/lib/date";
import { getAvatarUrl } from "@/lib/profile/avatar";
import {
  addDays,
  formatMinutes,
  getWeekStart,
  getWeeklyMinutes,
  type TimedShift,
} from "@/lib/shifts/hours";
import { createClient } from "@/lib/supabase/server";
import { CreateStaffForm } from "./create-staff-form";
import { ResetPasswordControl } from "./reset-password-control";

function HoursSummary({
  minutes,
}: {
  minutes: { thisWeek: number; nextWeek: number };
}) {
  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
      <span className="flex items-center gap-1">
        <AppIcon name="clock" className="h-3.5 w-3.5 text-indigo-500" />
        This week{" "}
        <span className="font-semibold tabular-nums text-slate-900">
          {formatMinutes(minutes.thisWeek)}
        </span>
      </span>
      <span>
        Next week{" "}
        <span className="font-semibold tabular-nums text-slate-900">
          {formatMinutes(minutes.nextWeek)}
        </span>
      </span>
    </p>
  );
}

export default async function AdminStaffPage() {
  const authenticatedProfile = await getAuthenticatedProfile();

  if (authenticatedProfile.role !== "admin") {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const today = getAppDateKey();
  const weekStart = getWeekStart(today);
  const [staffResult, shiftsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .eq("role", "staff")
      .order("full_name", { ascending: true })
      .order("username", { ascending: true }),
    // Confirmed shifts this week and next, for scheduled-hours totals.
    supabase
      .from("shifts")
      .select("date, start_time, end_time, assignments ( user_id )")
      .gte("date", weekStart)
      .lte("date", addDays(weekStart, 13)),
  ]);

  if (staffResult.error) {
    throw new Error("Unable to load staff profiles.");
  }

  if (shiftsResult.error) {
    throw new Error("Unable to load scheduled hours.");
  }

  const staff = staffResult.data;
  const shiftsByUser = new Map<string, TimedShift[]>();

  for (const shift of shiftsResult.data) {
    for (const assignment of shift.assignments ?? []) {
      const shifts = shiftsByUser.get(assignment.user_id) ?? [];
      shifts.push(shift);
      shiftsByUser.set(assignment.user_id, shifts);
    }
  }

  return (
    <main className="page-shell">
      <div className="page-container">
        <header className="page-header">
          <div>
            <p className="page-eyebrow">Team</p>
            <h1 className="page-title">Staff</h1>
            <p className="page-description">
              Add people to your team, check their hours, and reset passwords.
            </p>
          </div>
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
                  Existing staff profiles and confirmed hours (Mon–Sun).
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
                        <HoursSummary
                          minutes={getWeeklyMinutes(
                            shiftsByUser.get(staffMember.id) ?? [],
                            today,
                          )}
                        />
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
