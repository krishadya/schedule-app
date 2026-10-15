import { CalendarView } from "@/components/calendar/calendar-view";
import { AppIcon } from "@/components/ui/app-icon";
import { StatusBadge } from "@/components/ui/status-badge";
import { getAuthenticatedProfile } from "@/lib/auth/profile";
import { getCalendarData } from "@/lib/calendar/data";

export default async function DashboardPage() {
  const profile = await getAuthenticatedProfile();
  const calendarData = await getCalendarData(profile);
  const isAdmin = profile.role === "admin";

  return (
    <main className="page-shell">
      <div className="mx-auto w-full max-w-7xl">
        <header className="relative mb-6 overflow-hidden rounded-3xl bg-slate-950 px-5 py-6 text-white shadow-lg shadow-slate-200 sm:px-8 sm:py-7">
          <div className="absolute -right-12 -top-16 h-52 w-52 rounded-full bg-indigo-500/25 blur-2xl" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-indigo-200">Welcome</p>
              <h1 className="mt-1 break-words text-2xl font-bold tracking-tight sm:text-3xl">
                {profile.full_name}
              </h1>
              <p className="mt-2 break-all text-sm text-slate-300">
                @{profile.username}
              </p>
            </div>
            <div className="flex items-center gap-3 self-start sm:self-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-indigo-200 ring-1 ring-white/15">
                <AppIcon name={isAdmin ? "shield" : "account"} />
              </span>
              <StatusBadge tone={isAdmin ? "indigo" : "slate"}>
                {isAdmin ? "Admin" : "Staff"}
              </StatusBadge>
            </div>
          </div>
        </header>

        <CalendarView
          shifts={calendarData.shifts}
          today={calendarData.today}
          requestTimestamp={calendarData.requestTimestamp}
          isAdmin={isAdmin}
        />
      </div>
    </main>
  );
}
