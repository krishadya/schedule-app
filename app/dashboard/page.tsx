import { CalendarView } from "@/components/calendar/calendar-view";
import { StatusBadge } from "@/components/ui/status-badge";
import { UserAvatar } from "@/components/ui/user-avatar";
import { getAuthenticatedProfile } from "@/lib/auth/profile";
import { getCalendarData } from "@/lib/calendar/data";

export default async function DashboardPage() {
  const profile = await getAuthenticatedProfile();
  const calendarData = await getCalendarData(profile);
  const isAdmin = profile.role === "admin";

  return (
    <main className="page-shell">
      <div className="mx-auto w-full max-w-7xl">
        <header className="mb-6 flex flex-col gap-3 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="hidden sm:block">
            <UserAvatar
              name={profile.full_name}
              src={profile.avatar_url}
              size="md"
            />
            </span>
            <div>
              <p className="page-eyebrow">
                {isAdmin ? "Team overview" : "Your schedule"}
              </p>
              <h1 className="mt-1 break-words text-2xl font-bold tracking-[-0.03em] text-slate-950 sm:text-3xl">
                Hi, {profile.full_name.split(" ")[0]}
              </h1>
              <p className="mt-1.5 text-sm text-slate-500">
                {isAdmin
                  ? "Pick a shift to see its staffing, or add a new one."
                  : "Pick a shift to see details or tell your manager if you can work."}
              </p>
            </div>
          </div>
          <span className="hidden self-start sm:block sm:self-auto">
            <StatusBadge tone={isAdmin ? "indigo" : "slate"}>
              {isAdmin ? "Admin" : "Staff"}
            </StatusBadge>
          </span>
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
