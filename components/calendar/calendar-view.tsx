"use client";

import Link from "next/link";
import { useState } from "react";

import { AppIcon } from "@/components/ui/app-icon";
import { MetricCard } from "@/components/ui/metric-card";
import { StatusBadge } from "@/components/ui/status-badge";
import type {
  CalendarCoverage,
  CalendarShift,
  CalendarStatus,
} from "@/lib/calendar/types";

type CalendarViewProps = {
  shifts: CalendarShift[];
  today: string;
  requestTimestamp: number;
  isAdmin: boolean;
};

type Tone = "emerald" | "indigo" | "amber" | "rose" | "slate";

type Display = {
  label: string;
  tone: Tone;
  item: string;
  dot: string;
  accent: string;
};

type Filter = {
  value: string;
  label: string;
  matches: (shift: CalendarShift) => boolean;
};

const APP_TIME_ZONE = "America/Los_Angeles";
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const toneStyles: Record<Tone, Omit<Display, "label" | "tone">> = {
  emerald: {
    item: "border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100",
    dot: "bg-emerald-500",
    accent: "border-l-emerald-500",
  },
  indigo: {
    item: "border-indigo-200 bg-indigo-50 text-indigo-900 hover:bg-indigo-100",
    dot: "bg-indigo-500",
    accent: "border-l-indigo-500",
  },
  amber: {
    item: "border-amber-200 bg-amber-50 text-amber-950 hover:bg-amber-100",
    dot: "bg-amber-500",
    accent: "border-l-amber-500",
  },
  rose: {
    item: "border-rose-200 bg-rose-50 text-rose-900 hover:bg-rose-100",
    dot: "bg-rose-400",
    accent: "border-l-rose-400",
  },
  slate: {
    item: "border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100",
    dot: "bg-slate-400",
    accent: "border-l-slate-400",
  },
};

function display(label: string, tone: Tone): Display {
  return { label, tone, ...toneStyles[tone] };
}

// What a staff member sees: their own answer and assignment.
const staffDisplay: Record<CalendarStatus, Display> = {
  assigned: display("You're working", "emerald"),
  available: display("You said yes", "indigo"),
  maybe: display("You said maybe", "amber"),
  unavailable: display("You can't work", "rose"),
  "needs-response": display("Needs your answer", "slate"),
};

// What an admin sees: how well the shift is staffed.
const coverageDisplay: Record<CalendarCoverage["status"], Display> = {
  fully_staffed: display("Fully staffed", "emerald"),
  partially_staffed: display("Needs staff", "amber"),
  unstaffed: display("No one assigned", "slate"),
  no_requirements: display("No roles set", "slate"),
};

const staffFilters: Filter[] = [
  { value: "all", label: "All", matches: () => true },
  {
    value: "needs-response",
    label: "Needs your answer",
    matches: (shift) => shift.status === "needs-response",
  },
  {
    value: "assigned",
    label: "You're working",
    matches: (shift) => shift.status === "assigned",
  },
  {
    value: "responded",
    label: "You said yes / maybe",
    matches: (shift) => shift.status === "available" || shift.status === "maybe",
  },
];

function needsStaff(shift: CalendarShift) {
  return (
    shift.coverage?.status === "partially_staffed" ||
    shift.coverage?.status === "unstaffed"
  );
}

const adminFilters: Filter[] = [
  { value: "all", label: "All", matches: () => true },
  { value: "needs-staff", label: "Needs staff", matches: needsStaff },
  {
    value: "full",
    label: "Fully staffed",
    matches: (shift) => shift.coverage?.status === "fully_staffed",
  },
];

function getDisplay(shift: CalendarShift, isAdmin: boolean) {
  return isAdmin && shift.coverage
    ? coverageDisplay[shift.coverage.status]
    : staffDisplay[shift.status];
}

// Short label for the small calendar chips.
function getChipLabel(shift: CalendarShift, isAdmin: boolean) {
  if (!isAdmin || !shift.coverage) {
    return staffDisplay[shift.status].label;
  }

  const { status, open } = shift.coverage;

  if (status === "fully_staffed") return "Full";
  if (status === "no_requirements") return "No roles";
  return `${open} open`;
}

// Longer admin label for cards and badges.
function getStaffingLabel(coverage: CalendarCoverage) {
  if (coverage.status === "fully_staffed") return "Fully staffed";
  if (coverage.status === "no_requirements") return "No roles set";
  return `${coverage.filled} / ${coverage.required} staffed`;
}

function parseDateOnly(date: string) {
  const [year, month, day] = date.split("-").map(Number);

  return { year, month, day };
}

function toDateKey(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function dateOnlyToUtcDate(date: string) {
  const { year, month, day } = parseDateOnly(date);

  return new Date(Date.UTC(year, month - 1, day));
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(dateOnlyToUtcDate(date));
}

function formatCompactDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(dateOnlyToUtcDate(date));
}

function formatMonth(year: number, month: number) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function formatTime(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const twelveHour = hours % 12 || 12;

  return `${twelveHour}:${String(minutes).padStart(2, "0")} ${period}`;
}

// Compact time for small calendar chips: "9 AM", "2:30 PM".
function formatShortTime(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const twelveHour = hours % 12 || 12;

  return minutes === 0
    ? `${twelveHour} ${period}`
    : `${twelveHour}:${String(minutes).padStart(2, "0")} ${period}`;
}

function formatDeadline(deadline: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: APP_TIME_ZONE,
  })
    .format(new Date(deadline))
    .replace(",", " at");
}

function compareShifts(first: CalendarShift, second: CalendarShift) {
  const dateDifference = first.date.localeCompare(second.date);

  return dateDifference !== 0
    ? dateDifference
    : first.startTime.localeCompare(second.startTime);
}

function getUpcomingShifts(shifts: CalendarShift[], isAdmin: boolean) {
  if (isAdmin) {
    return [...shifts].sort(compareShifts).slice(0, 6);
  }

  const priority: Record<CalendarStatus, number> = {
    assigned: 0,
    "needs-response": 1,
    available: 2,
    maybe: 2,
    unavailable: 3,
  };

  return [...shifts]
    .filter((shift) => shift.status !== "unavailable")
    .sort(
      (first, second) =>
        priority[first.status] - priority[second.status] ||
        compareShifts(first, second),
    )
    .slice(0, 6)
    .sort(compareShifts);
}

function AdminStaffing({ shift }: { shift: CalendarShift }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-100">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">Staffing</h3>
        {shift.coverage && shift.coverage.required > 0 ? (
          <span className="text-sm font-semibold tabular-nums text-slate-700">
            {shift.coverage.filled} / {shift.coverage.required} filled
          </span>
        ) : null}
      </div>
      {shift.requirements.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {shift.requirements.map((requirement) => {
            const assigned = Math.min(
              requirement.assignedCount ?? 0,
              requirement.staffNeeded,
            );
            const full = assigned >= requirement.staffNeeded;

            return (
              <li key={requirement.role} className="text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-slate-700">{requirement.role}</span>
                  <span
                    className={`font-semibold tabular-nums ${full ? "text-emerald-700" : "text-slate-900"}`}
                  >
                    {assigned} / {requirement.staffNeeded}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={`h-full rounded-full ${full ? "bg-emerald-500" : "bg-amber-500"}`}
                    style={{
                      width: `${(assigned / requirement.staffNeeded) * 100}%`,
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-slate-500">No roles set for this shift.</p>
      )}
    </div>
  );
}

function StaffStatus({ shift }: { shift: CalendarShift }) {
  const responseLabel = shift.availability
    ? shift.availability.response.charAt(0).toUpperCase() +
      shift.availability.response.slice(1)
    : "Not answered yet";

  return (
    <>
      <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-100">
        <h3 className="text-sm font-semibold text-slate-900">Your status</h3>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Your answer</dt>
            <dd className="font-medium text-slate-900">{responseLabel}</dd>
          </div>
          {shift.assignedRole ? (
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Your role</dt>
              <dd className="font-medium text-slate-900">{shift.assignedRole}</dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Answer by</dt>
            <dd className="text-right font-medium text-slate-900">
              {formatDeadline(shift.responseDeadline)}
            </dd>
          </div>
        </dl>
      </div>
      <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-100">
        <h3 className="text-sm font-semibold text-slate-900">People needed</h3>
        {shift.requirements.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {shift.requirements.map((requirement) => (
              <li
                key={requirement.role}
                className="rounded-full bg-white px-3 py-1.5 text-sm text-slate-700 ring-1 ring-slate-200"
              >
                {requirement.role} × {requirement.staffNeeded}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-slate-500">None listed.</p>
        )}
      </div>
    </>
  );
}

function ShiftDetails({
  shift,
  requestTimestamp,
  isAdmin,
  onClose,
}: {
  shift: CalendarShift;
  requestTimestamp: number;
  isAdmin: boolean;
  onClose: () => void;
}) {
  const deadlinePassed =
    new Date(shift.responseDeadline).getTime() <= requestTimestamp;
  const shiftDisplay = getDisplay(shift, isAdmin);

  return (
    <section
      aria-label={`Details for ${shift.eventName}`}
      className={`surface-card border-l-4 ${shiftDisplay.accent} p-5 sm:p-6`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <StatusBadge tone={shiftDisplay.tone}>{shiftDisplay.label}</StatusBadge>
          <h2 className="mt-3 break-words text-xl font-bold tracking-tight text-slate-950">
            {shift.eventName}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          autoFocus
          className="btn btn-ghost"
        >
          Close
        </button>
      </div>

      <div className="mt-4 space-y-2 text-sm text-slate-700">
        <p className="flex items-start gap-2">
          <AppIcon name="calendar" className="mt-0.5 h-4 w-4 text-indigo-500" />
          <span>{formatDate(shift.date)}</span>
        </p>
        <p className="flex items-start gap-2">
          <AppIcon name="clock" className="mt-0.5 h-4 w-4 text-indigo-500" />
          <span>
            {formatTime(shift.startTime)} – {formatTime(shift.endTime)}
          </span>
        </p>
        {shift.location ? (
          <p className="flex items-start gap-2">
            <AppIcon name="location" className="mt-0.5 h-4 w-4 text-indigo-500" />
            <span>{shift.location}</span>
          </p>
        ) : null}
      </div>

      <div className="mt-5 grid gap-4">
        {isAdmin ? <AdminStaffing shift={shift} /> : <StaffStatus shift={shift} />}
      </div>

      {!isAdmin &&
      shift.availability?.response === "maybe" &&
      (shift.availability.suggestedStartTime ||
        shift.availability.suggestedEndTime) ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <span className="font-semibold">You can work: </span>
          {shift.availability.suggestedStartTime
            ? formatTime(shift.availability.suggestedStartTime)
            : "start"}
          {" – "}
          {shift.availability.suggestedEndTime
            ? formatTime(shift.availability.suggestedEndTime)
            : "end"}
        </div>
      ) : null}

      {!isAdmin && shift.availability?.note ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900">Your note</h3>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
            {shift.availability.note}
          </p>
        </div>
      ) : null}

      {shift.notes ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900">Shift notes</h3>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
            {shift.notes}
          </p>
        </div>
      ) : null}

      {isAdmin ? (
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Link href={`/admin/shifts/${shift.id}`} className="btn btn-primary">
            Manage Staffing
          </Link>
          <Link href={`/admin/shifts/${shift.id}/edit`} className="btn btn-secondary">
            Edit
          </Link>
          <Link
            href={`/admin/shifts/new?duplicate=${shift.id}`}
            className="btn btn-secondary"
          >
            Duplicate
          </Link>
        </div>
      ) : shift.assignedRole ? (
        <div className="mt-5">
          <Link href="/schedule" className="btn btn-secondary">
            View in My Schedule
          </Link>
        </div>
      ) : (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {!deadlinePassed ? (
            <Link href={`/shifts#shift-${shift.id}`} className="btn btn-primary">
              {shift.availability ? "Change My Answer" : "Answer Now"}
            </Link>
          ) : (
            <StatusBadge>Answers closed</StatusBadge>
          )}
        </div>
      )}
    </section>
  );
}

export function CalendarView({
  shifts,
  today,
  requestTimestamp,
  isAdmin,
}: CalendarViewProps) {
  const currentDate = parseDateOnly(today);
  const [visibleMonth, setVisibleMonth] = useState({
    year: currentDate.year,
    month: currentDate.month,
  });
  const filters = isAdmin ? adminFilters : staffFilters;
  const [activeFilter, setActiveFilter] = useState("all");
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);

  const filter = filters.find((item) => item.value === activeFilter) ?? filters[0];
  const monthPrefix = `${visibleMonth.year}-${String(visibleMonth.month).padStart(2, "0")}-`;
  const monthShifts = shifts.filter(
    (shift) => shift.date.startsWith(monthPrefix) && filter.matches(shift),
  );
  const selectedShift =
    shifts.find((shift) => shift.id === selectedShiftId) ?? null;
  const upcomingShifts = getUpcomingShifts(shifts, isAdmin);
  const needsResponseCount = shifts.filter(
    (shift) =>
      shift.status === "needs-response" &&
      new Date(shift.responseDeadline).getTime() > requestTimestamp,
  ).length;

  const firstWeekday = new Date(
    Date.UTC(visibleMonth.year, visibleMonth.month - 1, 1),
  ).getUTCDay();
  const daysInMonth = new Date(
    Date.UTC(visibleMonth.year, visibleMonth.month, 0),
  ).getUTCDate();
  const cellCount = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
  const cells = Array.from({ length: cellCount }, (_, index) => {
    const day = index - firstWeekday + 1;

    return day >= 1 && day <= daysInMonth ? day : null;
  });
  const shiftsByDate = new Map<string, CalendarShift[]>();

  for (const shift of monthShifts) {
    const existing = shiftsByDate.get(shift.date) ?? [];
    existing.push(shift);
    shiftsByDate.set(shift.date, existing);
  }

  function moveMonth(offset: number) {
    const nextMonth = new Date(
      Date.UTC(visibleMonth.year, visibleMonth.month - 1 + offset, 1),
    );

    setVisibleMonth({
      year: nextMonth.getUTCFullYear(),
      month: nextMonth.getUTCMonth() + 1,
    });
    setSelectedShiftId(null);
  }

  function showToday() {
    setVisibleMonth({ year: currentDate.year, month: currentDate.month });
    setSelectedShiftId(null);
  }

  function changeFilter(value: string) {
    setActiveFilter(value);
    setSelectedShiftId(null);
  }

  function selectShift(shiftId: string, toggle = false) {
    setSelectedShiftId((current) =>
      toggle && current === shiftId ? null : shiftId,
    );
  }

  const adminCounts = {
    needsStaff: shifts.filter(needsStaff).length,
    full: shifts.filter((shift) => shift.coverage?.status === "fully_staffed")
      .length,
    openSlots: shifts.reduce((total, shift) => total + (shift.coverage?.open ?? 0), 0),
  };
  const staffCounts = {
    assigned: shifts.filter((shift) => shift.status === "assigned").length,
    responded: shifts.filter(
      (shift) => shift.status === "available" || shift.status === "maybe",
    ).length,
  };

  return (
    <>
      {!isAdmin && needsResponseCount > 0 ? (
        <div className="mb-5 flex flex-col gap-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-indigo-950">
              {needsResponseCount}{" "}
              {needsResponseCount === 1 ? "shift is" : "shifts are"} waiting for
              your answer
            </p>
            <p className="mt-0.5 text-sm text-indigo-800">
              Let your manager know if you can work.
            </p>
          </div>
          <Link href="/shifts" className="btn btn-primary shrink-0">
            Answer Now
          </Link>
        </div>
      ) : null}

      <section
        aria-label="Schedule summary"
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        {isAdmin ? (
          <>
            <MetricCard
              label="Upcoming shifts"
              value={shifts.length}
              tone="indigo"
              icon={<AppIcon name="calendar" className="h-4 w-4" />}
              description="From today onward"
            />
            <MetricCard
              label="Needs staff"
              value={adminCounts.needsStaff}
              tone="amber"
              icon={<AppIcon name="users" className="h-4 w-4" />}
              description="Shifts with open slots"
            />
            <MetricCard
              label="Open slots"
              value={adminCounts.openSlots}
              tone="slate"
              icon={<AppIcon name="plus" className="h-4 w-4" />}
              description="People still needed"
            />
            <MetricCard
              label="Fully staffed"
              value={adminCounts.full}
              tone="emerald"
              icon={<AppIcon name="check" className="h-4 w-4" />}
              description="Every role filled"
            />
          </>
        ) : (
          <>
            <MetricCard
              label="Needs your answer"
              value={needsResponseCount}
              tone="indigo"
              icon={<AppIcon name="calendar" className="h-4 w-4" />}
              description="Open for responses"
            />
            <MetricCard
              label="You're working"
              value={staffCounts.assigned}
              tone="emerald"
              icon={<AppIcon name="check" className="h-4 w-4" />}
              description="Confirmed shifts"
            />
            <MetricCard
              label="You said yes / maybe"
              value={staffCounts.responded}
              tone="amber"
              icon={<AppIcon name="clock" className="h-4 w-4" />}
              description="Not assigned yet"
            />
            <MetricCard
              label="Upcoming shifts"
              value={shifts.length}
              tone="slate"
              icon={<AppIcon name="schedule" className="h-4 w-4" />}
              description="Posted by managers"
            />
          </>
        )}
      </section>

      <div
        className={`mt-6 grid items-start gap-5 ${
          selectedShift ? "2xl:grid-cols-[minmax(0,1fr)_24rem]" : ""
        }`}
      >
        <section
          aria-labelledby="month-heading"
          className="surface-card min-w-0 overflow-hidden"
        >
          <div className="border-b border-slate-200 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2
                id="month-heading"
                aria-live="polite"
                className="text-xl font-bold tracking-tight text-slate-950"
              >
                {formatMonth(visibleMonth.year, visibleMonth.month)}
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveMonth(-1)}
                    className="btn btn-secondary px-3"
                    aria-label="Previous month"
                  >
                    <span aria-hidden="true">←</span>
                  </button>
                  <button type="button" onClick={showToday} className="btn btn-secondary">
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => moveMonth(1)}
                    className="btn btn-secondary px-3"
                    aria-label="Next month"
                  >
                    <span aria-hidden="true">→</span>
                  </button>
                </div>
                {isAdmin ? (
                  <Link href="/admin/shifts/new" className="btn btn-primary">
                    <AppIcon name="plus" className="h-4 w-4" />
                    New Shift
                  </Link>
                ) : null}
              </div>
            </div>

            <div
              className="mt-4 flex gap-2 overflow-x-auto pb-1"
              role="group"
              aria-label="Show"
            >
              {filters.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  aria-pressed={activeFilter === item.value}
                  onClick={() => changeFilter(item.value)}
                  className={`min-h-9 shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
                    activeFilter === item.value
                      ? "border-indigo-600 bg-indigo-600 text-white"
                      : "border-slate-300 bg-white text-slate-600 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="hidden md:block">
            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
              {WEEKDAYS.map((weekday) => (
                <div
                  key={weekday}
                  className="px-2 py-2 text-center text-xs font-bold uppercase tracking-wide text-slate-500"
                >
                  {weekday}
                </div>
              ))}
            </div>
            <div
              role="grid"
              aria-label={formatMonth(visibleMonth.year, visibleMonth.month)}
              className="grid grid-cols-7 gap-px bg-slate-200"
            >
              {cells.map((day, index) => {
                if (day === null) {
                  return (
                    <div
                      key={`empty-${index}`}
                      role="gridcell"
                      className="min-h-32 bg-slate-50"
                    />
                  );
                }

                const date = toDateKey(visibleMonth.year, visibleMonth.month, day);
                const dayShifts = shiftsByDate.get(date) ?? [];
                const isToday = date === today;
                const isPast = date < today;

                return (
                  <div
                    key={date}
                    role="gridcell"
                    aria-label={`${formatDate(date)}, ${dayShifts.length} shifts`}
                    className={`group min-h-32 min-w-0 p-2 ${isPast ? "bg-slate-50/70" : "bg-white"}`}
                  >
                    <div className="mb-1.5 flex items-center justify-between">
                      <span
                        className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                          isToday
                            ? "bg-indigo-600 text-white"
                            : isPast
                              ? "text-slate-400"
                              : "text-slate-700"
                        }`}
                      >
                        {day}
                      </span>
                      {isAdmin && !isPast ? (
                        <Link
                          href={`/admin/shifts/new?date=${date}`}
                          aria-label={`Create a shift on ${formatDate(date)}`}
                          title="Add a shift on this day"
                          className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 opacity-0 transition hover:bg-indigo-50 hover:text-indigo-700 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-indigo-600 group-hover:opacity-100"
                        >
                          <AppIcon name="plus" className="h-4 w-4" />
                        </Link>
                      ) : null}
                    </div>
                    <div className="max-h-24 space-y-1.5 overflow-y-auto pr-0.5">
                      {dayShifts.map((shift) => {
                        const shiftDisplay = getDisplay(shift, isAdmin);

                        return (
                          <button
                            key={shift.id}
                            type="button"
                            onClick={() => selectShift(shift.id)}
                            aria-expanded={selectedShiftId === shift.id}
                            className={`block w-full rounded-md border px-2 py-1.5 text-left text-xs transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-indigo-600 ${shiftDisplay.item} ${
                              selectedShiftId === shift.id ? "ring-2 ring-indigo-500" : ""
                            }`}
                          >
                            <span className="block truncate font-semibold">
                              {shift.eventName}
                            </span>
                            <span className="mt-0.5 flex items-center gap-1 truncate opacity-80">
                              <span
                                className={`h-1.5 w-1.5 shrink-0 rounded-full ${shiftDisplay.dot}`}
                              />
                              {formatShortTime(shift.startTime)} ·{" "}
                              {getChipLabel(shift, isAdmin)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {monthShifts.length === 0 ? (
              <div className="border-t border-slate-200 px-5 py-6 text-center text-sm text-slate-500">
                No shifts to show for{" "}
                {formatMonth(visibleMonth.year, visibleMonth.month)}.
              </div>
            ) : null}
          </div>

          <div className="divide-y divide-slate-100 md:hidden">
            {monthShifts.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <AppIcon name="calendar" className="mx-auto h-7 w-7 text-slate-400" />
                <p className="mt-3 text-sm font-medium text-slate-700">
                  No shifts to show this month.
                </p>
              </div>
            ) : (
              monthShifts.map((shift) => {
                const shiftDisplay = getDisplay(shift, isAdmin);
                const isSelected = selectedShiftId === shift.id;

                return (
                  <div key={shift.id} className="p-3">
                    <button
                      type="button"
                      onClick={() => selectShift(shift.id, true)}
                      aria-expanded={isSelected}
                      className={`w-full rounded-xl border p-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${shiftDisplay.item} ${
                        isSelected ? "ring-2 ring-indigo-500 ring-offset-2" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
                            {formatCompactDate(shift.date)}
                          </p>
                          <p className="mt-1 truncate font-semibold">
                            {shift.eventName}
                          </p>
                          <p className="mt-1 text-sm opacity-80">
                            {formatTime(shift.startTime)} – {formatTime(shift.endTime)}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs font-bold">
                          {getChipLabel(shift, isAdmin)}
                        </span>
                      </div>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {selectedShift ? (
          <aside
            aria-label="Selected shift details"
            className="sticky top-24 hidden 2xl:block"
          >
            <ShiftDetails
              key={selectedShift.id}
              shift={selectedShift}
              requestTimestamp={requestTimestamp}
              isAdmin={isAdmin}
              onClose={() => setSelectedShiftId(null)}
            />
          </aside>
        ) : null}
      </div>

      {selectedShift ? (
        <div className="pointer-events-none fixed inset-0 z-50 2xl:hidden">
          <button
            type="button"
            aria-label="Close shift details"
            onClick={() => setSelectedShiftId(null)}
            className="pointer-events-auto absolute inset-0 bg-slate-950/40 md:hidden"
          />
          <div
            role="region"
            aria-live="polite"
            aria-label={`Selected shift: ${selectedShift.eventName}`}
            className="pointer-events-auto absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-2xl bg-slate-50 p-3 shadow-2xl md:inset-x-auto md:bottom-6 md:right-6 md:top-24 md:w-[30rem] md:max-w-[calc(100vw-3rem)] md:rounded-xl md:p-0"
          >
            <ShiftDetails
              key={selectedShift.id}
              shift={selectedShift}
              requestTimestamp={requestTimestamp}
              isAdmin={isAdmin}
              onClose={() => setSelectedShiftId(null)}
            />
          </div>
        </div>
      ) : null}

      <section aria-labelledby="upcoming-heading" className="mt-8">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <h2 id="upcoming-heading" className="section-title">
            {isAdmin ? "Next shifts" : "Coming up"}
          </h2>
          {isAdmin ? (
            <Link
              href="/admin/shifts"
              className="text-sm font-semibold text-indigo-700 hover:text-indigo-900"
            >
              See all shifts →
            </Link>
          ) : null}
        </div>

        {upcomingShifts.length === 0 ? (
          <div className="empty-state py-8">
            <p className="text-sm text-slate-600">
              {isAdmin
                ? "No upcoming shifts. Create one to get started."
                : "Nothing coming up yet. New shifts will appear here."}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {upcomingShifts.map((shift) => {
              const shiftDisplay = getDisplay(shift, isAdmin);

              return (
                <button
                  key={shift.id}
                  type="button"
                  onClick={() => {
                    const shiftDate = parseDateOnly(shift.date);
                    setVisibleMonth({
                      year: shiftDate.year,
                      month: shiftDate.month,
                    });
                    setActiveFilter("all");
                    selectShift(shift.id);
                  }}
                  className={`surface-card interactive-card flex w-full items-start gap-4 p-4 text-left ${
                    selectedShiftId === shift.id
                      ? "border-indigo-300 ring-2 ring-indigo-500 ring-offset-2"
                      : ""
                  }`}
                >
                  <span className={`mt-1.5 h-3 w-3 shrink-0 rounded-full ${shiftDisplay.dot}`} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-start justify-between gap-2">
                      <span className="font-semibold text-slate-950">
                        {shift.eventName}
                      </span>
                      <StatusBadge tone={shiftDisplay.tone}>
                        {isAdmin && shift.coverage
                          ? getStaffingLabel(shift.coverage)
                          : shiftDisplay.label}
                      </StatusBadge>
                    </span>
                    <span className="mt-1 block text-sm text-slate-600">
                      {formatCompactDate(shift.date)} · {formatTime(shift.startTime)} –{" "}
                      {formatTime(shift.endTime)}
                    </span>
                    {shift.location ? (
                      <span className="mt-1 block truncate text-xs text-slate-500">
                        {shift.location}
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
