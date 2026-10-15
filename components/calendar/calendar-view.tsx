"use client";

import Link from "next/link";
import { useState } from "react";

import { AppIcon } from "@/components/ui/app-icon";
import { StatusBadge } from "@/components/ui/status-badge";
import type {
  CalendarShift,
  CalendarStatus,
} from "@/lib/calendar/types";

type CalendarFilter =
  | "all"
  | "assigned"
  | "available"
  | "maybe"
  | "needs-response";

type CalendarViewProps = {
  shifts: CalendarShift[];
  today: string;
  requestTimestamp: number;
  isAdmin: boolean;
};

const APP_TIME_ZONE = "America/Los_Angeles";
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const filters: Array<{ value: CalendarFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "assigned", label: "Assigned" },
  { value: "available", label: "Available / Yes" },
  { value: "maybe", label: "Maybe" },
  { value: "needs-response", label: "Needs Response" },
];

const statusStyles: Record<
  CalendarStatus,
  {
    label: string;
    tone: "emerald" | "indigo" | "amber" | "rose" | "slate";
    item: string;
    dot: string;
    accent: string;
  }
> = {
  assigned: {
    label: "Assigned",
    tone: "emerald",
    item: "border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100",
    dot: "bg-emerald-500",
    accent: "border-l-emerald-500",
  },
  available: {
    label: "Available",
    tone: "indigo",
    item: "border-indigo-200 bg-indigo-50 text-indigo-900 hover:bg-indigo-100",
    dot: "bg-indigo-500",
    accent: "border-l-indigo-500",
  },
  maybe: {
    label: "Maybe",
    tone: "amber",
    item: "border-amber-200 bg-amber-50 text-amber-950 hover:bg-amber-100",
    dot: "bg-amber-500",
    accent: "border-l-amber-500",
  },
  unavailable: {
    label: "Unavailable",
    tone: "rose",
    item: "border-rose-200 bg-rose-50 text-rose-900 hover:bg-rose-100",
    dot: "bg-rose-400",
    accent: "border-l-rose-400",
  },
  "needs-response": {
    label: "Response Needed",
    tone: "slate",
    item: "border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100",
    dot: "bg-slate-400",
    accent: "border-l-slate-400",
  },
};

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

function formatDeadline(deadline: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: APP_TIME_ZONE,
    timeZoneName: "short",
  }).format(new Date(deadline));
}

function compareShifts(first: CalendarShift, second: CalendarShift) {
  const dateDifference = first.date.localeCompare(second.date);

  return dateDifference !== 0
    ? dateDifference
    : first.startTime.localeCompare(second.startTime);
}

function matchesFilter(shift: CalendarShift, filter: CalendarFilter) {
  return filter === "all" || shift.status === filter;
}

function getMonthShifts(
  shifts: CalendarShift[],
  year: number,
  month: number,
  filter: CalendarFilter,
) {
  const monthPrefix = `${year}-${String(month).padStart(2, "0")}-`;

  return shifts.filter(
    (shift) => shift.date.startsWith(monthPrefix) && matchesFilter(shift, filter),
  );
}

function getUpcomingShifts(shifts: CalendarShift[]) {
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

function StatusLabel({ status }: { status: CalendarStatus }) {
  const style = statusStyles[status];

  return <StatusBadge tone={style.tone}>{style.label}</StatusBadge>;
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
  const responseLabel = shift.availability
    ? shift.availability.response.charAt(0).toUpperCase() +
      shift.availability.response.slice(1)
    : "No response";

  return (
    <section
      aria-label={`Details for ${shift.eventName}`}
      className={`surface-card border-l-4 ${statusStyles[shift.status].accent} p-5 sm:p-6`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusLabel status={shift.status} />
            {shift.assignedRole ? (
              <StatusBadge tone="indigo">{shift.assignedRole}</StatusBadge>
            ) : null}
          </div>
          <h2 className="mt-3 text-xl font-bold tracking-tight text-slate-950">
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

      <div className="mt-5 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
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
          <p className="flex items-start gap-2 sm:col-span-2">
            <AppIcon name="location" className="mt-0.5 h-4 w-4 text-indigo-500" />
            <span>{shift.location}</span>
          </p>
        ) : null}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-100">
          <h3 className="text-sm font-semibold text-slate-900">
            Staffing requirements
          </h3>
          {shift.requirements.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {shift.requirements.map((requirement) => (
                <li
                  key={requirement.role}
                  className="rounded-full bg-white px-3 py-1.5 text-sm text-slate-700 ring-1 ring-slate-200"
                >
                  {requirement.role}: {isAdmin && requirement.assignedCount !== null
                    ? `${requirement.assignedCount} / ${requirement.staffNeeded} assigned`
                    : `${requirement.staffNeeded} needed`}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-slate-500">None listed.</p>
          )}
        </div>

        <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-100">
          <h3 className="text-sm font-semibold text-slate-900">Your status</h3>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Response</dt>
              <dd className="font-medium text-slate-900">{responseLabel}</dd>
            </div>
            {shift.assignedRole ? (
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Assigned role</dt>
                <dd className="font-medium text-slate-900">
                  {shift.assignedRole}
                </dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Response deadline</dt>
              <dd className="text-right font-medium text-slate-900">
                {formatDeadline(shift.responseDeadline)}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {shift.availability?.response === "maybe" &&
      (shift.availability.suggestedStartTime ||
        shift.availability.suggestedEndTime) ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <span className="font-semibold">Maybe availability: </span>
          {shift.availability.suggestedStartTime
            ? formatTime(shift.availability.suggestedStartTime)
            : "Not specified"}
          {" – "}
          {shift.availability.suggestedEndTime
            ? formatTime(shift.availability.suggestedEndTime)
            : "Not specified"}
        </div>
      ) : null}

      {shift.availability?.note ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900">
            Your availability note
          </h3>
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

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {!deadlinePassed ? (
          <Link href={`/shifts#shift-${shift.id}`} className="btn btn-primary">
            {shift.availability ? "Update Availability" : "Set Availability"}
          </Link>
        ) : (
          <StatusBadge>Responses closed</StatusBadge>
        )}
        <span className="text-sm text-slate-500">
          Deadline: {formatDeadline(shift.responseDeadline)}
        </span>
      </div>

      {isAdmin ? (
        <div className="mt-5 flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row">
          <Link
            href={`/admin/shifts/${shift.id}`}
            className="btn btn-primary w-full sm:w-auto"
          >
            View Responses / Assign Staff
          </Link>
          <Link
            href={`/admin/shifts/${shift.id}/edit`}
            className="btn btn-secondary w-full sm:w-auto"
          >
            Edit Shift
          </Link>
        </div>
      ) : null}
    </section>
  );
}

function SelectedDateAction({ date }: { date: string }) {
  return (
    <div className="mt-4 flex flex-col gap-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-indigo-600">
          Selected date
        </p>
        <p className="mt-1 font-semibold text-slate-950">
          Create shift on {formatDate(date)}
        </p>
      </div>
      <Link
        href={`/admin/shifts/new?date=${date}`}
        className="btn btn-primary w-full sm:w-auto"
      >
        + Create Shift
      </Link>
    </div>
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
  const [activeFilter, setActiveFilter] = useState<CalendarFilter>("all");
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const counts = {
    assigned: shifts.filter((shift) => shift.status === "assigned").length,
    available: shifts.filter((shift) => shift.status === "available").length,
    maybe: shifts.filter((shift) => shift.status === "maybe").length,
    needsResponse: shifts.filter((shift) => shift.status === "needs-response")
      .length,
  };
  const monthShifts = getMonthShifts(
    shifts,
    visibleMonth.year,
    visibleMonth.month,
    activeFilter,
  );
  const selectedShift =
    shifts.find((shift) => shift.id === selectedShiftId) ?? null;
  const upcomingShifts = getUpcomingShifts(shifts);
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
    setSelectedDate(null);
  }

  function showToday() {
    setVisibleMonth({ year: currentDate.year, month: currentDate.month });
    setSelectedShiftId(null);
    setSelectedDate(null);
  }

  function changeFilter(filter: CalendarFilter) {
    setActiveFilter(filter);
    setSelectedShiftId(null);
  }

  function selectDate(date: string) {
    setSelectedDate((current) => (current === date ? null : date));
    setSelectedShiftId(null);
  }

  function selectShift(shiftId: string, toggle = false) {
    setSelectedShiftId((current) =>
      toggle && current === shiftId ? null : shiftId,
    );
    setSelectedDate(null);
  }

  return (
    <>
      <section aria-label="Schedule summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="surface-card border-l-4 border-l-emerald-500 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Assigned
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-950">
            {counts.assigned}
          </p>
        </div>
        <div className="surface-card border-l-4 border-l-indigo-500 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Available
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-950">
            {counts.available}
          </p>
        </div>
        <div className="surface-card border-l-4 border-l-amber-500 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Maybe
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-950">{counts.maybe}</p>
        </div>
        <div className="surface-card border-l-4 border-l-slate-400 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Needs Response
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-950">
            {counts.needsResponse}
          </p>
        </div>
      </section>

      <section aria-labelledby="month-heading" className="surface-card mt-6 overflow-hidden">
        <div className="border-b border-slate-200 p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => moveMonth(-1)}
                className="btn btn-secondary px-3"
                aria-label="Previous month"
              >
                <span aria-hidden="true">←</span>
                <span className="hidden sm:inline">Previous</span>
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
                <span className="hidden sm:inline">Next</span>
                <span aria-hidden="true">→</span>
              </button>
            </div>
            <h2
              id="month-heading"
              aria-live="polite"
              className="text-xl font-bold tracking-tight text-slate-950 lg:order-first"
            >
              {formatMonth(visibleMonth.year, visibleMonth.month)}
            </h2>
          </div>

          <div className="mt-4 flex flex-wrap gap-2" aria-label="Calendar filters">
            {filters.map((filter) => (
              <button
                key={filter.value}
                type="button"
                aria-pressed={activeFilter === filter.value}
                onClick={() => changeFilter(filter.value)}
                className={`min-h-9 rounded-full border px-3 py-1.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
                  activeFilter === filter.value
                    ? "border-indigo-600 bg-indigo-600 text-white"
                    : "border-slate-300 bg-white text-slate-600 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {isAdmin && selectedDate ? (
            <div className="hidden md:block">
              <SelectedDateAction date={selectedDate} />
            </div>
          ) : null}
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
          <div role="grid" aria-label={formatMonth(visibleMonth.year, visibleMonth.month)} className="grid grid-cols-7 bg-slate-200 gap-px">
            {cells.map((day, index) => {
              if (day === null) {
                return (
                  <div
                    key={`empty-${index}`}
                    role="gridcell"
                    className="min-h-36 bg-slate-50/80"
                  />
                );
              }

              const date = toDateKey(
                visibleMonth.year,
                visibleMonth.month,
                day,
              );
              const dayShifts = shiftsByDate.get(date) ?? [];
              const isToday = date === today;

              return (
                <div
                  key={date}
                  role="gridcell"
                  aria-label={`${formatDate(date)}, ${dayShifts.length} shifts`}
                  className={`min-h-36 min-w-0 bg-white p-2 ${isToday ? "ring-2 ring-inset ring-indigo-400" : ""}`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    {isAdmin ? (
                      <button
                        type="button"
                        onClick={() => selectDate(date)}
                        aria-pressed={selectedDate === date}
                        aria-label={`Select ${formatDate(date)} to create a shift`}
                        className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
                          selectedDate === date
                            ? "bg-indigo-600 text-white"
                            : isToday
                              ? "bg-indigo-100 text-indigo-800 ring-1 ring-indigo-300"
                              : "text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"
                        }`}
                      >
                        {day}
                      </button>
                    ) : (
                      <span
                        className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                          isToday
                            ? "bg-indigo-600 text-white"
                            : "text-slate-700"
                        }`}
                      >
                        {day}
                      </span>
                    )}
                    {dayShifts.length > 0 ? (
                      <span className="text-[11px] font-medium text-slate-400">
                        {dayShifts.length}
                      </span>
                    ) : null}
                  </div>
                  <div className="max-h-24 space-y-1.5 overflow-y-auto pr-0.5">
                    {dayShifts.map((shift) => {
                      const style = statusStyles[shift.status];

                      return (
                        <button
                          key={shift.id}
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            selectShift(shift.id);
                          }}
                          aria-expanded={selectedShiftId === shift.id}
                          className={`block w-full rounded-md border px-2 py-1.5 text-left text-xs transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-indigo-600 ${style.item} ${
                            selectedShiftId === shift.id
                              ? "ring-2 ring-indigo-500"
                              : ""
                          }`}
                        >
                          <span className="block truncate font-semibold">
                            {shift.eventName}
                          </span>
                          <span className="mt-0.5 flex items-center gap-1 truncate opacity-80">
                            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${style.dot}`} />
                            {formatTime(shift.startTime)} · {style.label}
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
              No shifts match this view for {formatMonth(visibleMonth.year, visibleMonth.month)}.
            </div>
          ) : null}
        </div>

        {isAdmin ? (
          <div className="border-b border-slate-200 bg-slate-50 p-3 md:hidden">
            <p className="mb-2 text-xs font-semibold text-slate-600">
              Select any date to create another shift
            </p>
            <div className="grid grid-cols-7 gap-1" aria-label="Select a shift date">
              {WEEKDAYS.map((weekday) => (
                <span
                  key={weekday}
                  className="py-1 text-center text-[10px] font-bold uppercase text-slate-400"
                >
                  {weekday.charAt(0)}
                </span>
              ))}
              {cells.map((day, index) => {
                if (day === null) {
                  return <span key={`mobile-empty-${index}`} />;
                }

                const date = toDateKey(
                  visibleMonth.year,
                  visibleMonth.month,
                  day,
                );
                const hasShifts = (shiftsByDate.get(date)?.length ?? 0) > 0;

                return (
                  <button
                    key={date}
                    type="button"
                    onClick={() => selectDate(date)}
                    aria-pressed={selectedDate === date}
                    aria-label={`Select ${formatDate(date)} to create a shift`}
                    className={`relative flex min-h-9 items-center justify-center rounded-lg text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-indigo-600 ${
                      selectedDate === date
                        ? "bg-indigo-600 text-white"
                        : date === today
                          ? "bg-indigo-100 text-indigo-800"
                          : "bg-white text-slate-700 ring-1 ring-slate-200"
                    }`}
                  >
                    {day}
                    {hasShifts ? (
                      <span
                        aria-hidden="true"
                        className={`absolute bottom-1 h-1 w-1 rounded-full ${
                          selectedDate === date ? "bg-white" : "bg-indigo-500"
                        }`}
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>
            {selectedDate ? <SelectedDateAction date={selectedDate} /> : null}
          </div>
        ) : null}

        <div className="divide-y divide-slate-200 md:hidden">
          {monthShifts.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <AppIcon name="calendar" className="mx-auto h-7 w-7 text-slate-400" />
              <p className="mt-3 text-sm font-medium text-slate-700">
                No shifts match this month.
              </p>
            </div>
          ) : (
            monthShifts.map((shift) => {
              const style = statusStyles[shift.status];
              const isSelected = selectedShiftId === shift.id;

              return (
                <div key={shift.id} className="p-4">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      selectShift(shift.id, true);
                    }}
                    aria-expanded={isSelected}
                    className={`w-full rounded-xl border p-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${style.item} ${
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
                        {style.label}
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
        <div className="pointer-events-none fixed inset-0 z-50">
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
            className="pointer-events-auto absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-slate-50 p-3 shadow-2xl md:inset-x-auto md:bottom-6 md:right-6 md:top-24 md:w-[30rem] md:max-w-[calc(100vw-3rem)] md:rounded-2xl md:p-0"
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
          <div>
            <p className="page-eyebrow">Next up</p>
            <h2 id="upcoming-heading" className="section-title mt-1">
              Upcoming
            </h2>
          </div>
          <p className="text-sm text-slate-500">
            Assignments and responses that need your attention
          </p>
        </div>

        {upcomingShifts.length === 0 ? (
          <div className="empty-state py-8">
            <p className="text-sm text-slate-600">
              No assigned shifts or open availability items are coming up.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {upcomingShifts.map((shift) => {
              const style = statusStyles[shift.status];

              return (
                <button
                  key={shift.id}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
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
                  <span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${style.dot}`} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-start justify-between gap-2">
                      <span className="font-semibold text-slate-950">
                        {shift.eventName}
                      </span>
                      <StatusLabel status={shift.status} />
                    </span>
                    <span className="mt-1 block text-sm text-slate-600">
                      {formatCompactDate(shift.date)} · {formatTime(shift.startTime)}
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
