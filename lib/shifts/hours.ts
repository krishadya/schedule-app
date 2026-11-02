// Scheduled-hours math. Everything works on plain YYYY-MM-DD calendar
// dates (no timezone conversion), and weeks run Monday through Sunday.

import { timeToMinutes } from "./conflicts";

export type TimedShift = {
  date: string;
  start_time: string;
  end_time: string;
};

export function getShiftMinutes(shift: Pick<TimedShift, "start_time" | "end_time">) {
  return Math.max(0, timeToMinutes(shift.end_time) - timeToMinutes(shift.start_time));
}

function toUtcDate(dateKey: string) {
  return new Date(`${dateKey}T00:00:00Z`);
}

export function addDays(dateKey: string, days: number) {
  const date = toUtcDate(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function getWeekStart(dateKey: string) {
  const dayOfWeek = toUtcDate(dateKey).getUTCDay(); // 0 = Sunday
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  return addDays(dateKey, -daysSinceMonday);
}

export function sumMinutesInRange(
  shifts: TimedShift[],
  startDate: string,
  endDate: string,
) {
  return shifts.reduce(
    (total, shift) =>
      shift.date >= startDate && shift.date <= endDate
        ? total + getShiftMinutes(shift)
        : total,
    0,
  );
}

export type WeeklyMinutes = { thisWeek: number; nextWeek: number };

export function getWeeklyMinutes(shifts: TimedShift[], todayKey: string): WeeklyMinutes {
  const thisWeekStart = getWeekStart(todayKey);
  const nextWeekStart = addDays(thisWeekStart, 7);

  return {
    thisWeek: sumMinutesInRange(shifts, thisWeekStart, addDays(thisWeekStart, 6)),
    nextWeek: sumMinutesInRange(shifts, nextWeekStart, addDays(nextWeekStart, 6)),
  };
}

export function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  if (hours === 0 && remainder === 0) {
    return "0h";
  }

  if (hours === 0) {
    return `${remainder}m`;
  }

  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
}
