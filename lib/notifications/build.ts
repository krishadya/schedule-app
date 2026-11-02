// In-app notifications are computed from existing scheduling data rather
// than stored. Items disappear on their own once they're handled (a staff
// member responds, a shift gets fully staffed, a date passes).

import { calculateShiftCoverage } from "../shifts/coverage";

export type NotificationTone = "amber" | "indigo" | "emerald" | "slate";

export type NotificationItem = {
  id: string;
  title: string;
  detail: string;
  href: string;
  tone: NotificationTone;
  // Actionable items need something done and count toward the badge.
  actionable: boolean;
};

export type StaffNotificationInput = {
  now: Date;
  todayKey: string;
  timeZone: string;
  shifts: Array<{
    id: string;
    event_name: string;
    date: string;
    start_time: string;
    response_deadline: string;
  }>;
  respondedShiftIds: Set<string>;
  assignments: Array<{
    shift_id: string;
    assigned_role: string;
    assigned_at: string | null;
  }>;
  resolvedReplacements?: Array<{
    id: string;
    status: string;
    admin_note: string | null;
    resolved_at: string | null;
    event_name: string;
    date: string;
  }>;
};

export type AdminNotificationInput = {
  now: Date;
  todayKey: string;
  timeZone: string;
  shifts: Array<{
    id: string;
    event_name: string;
    date: string;
    start_time: string;
    response_deadline: string;
    shift_requirements: Array<{ role: string; staff_needed: number }> | null;
    assignments: Array<{ assigned_role: string }> | null;
    availability_responses: Array<{
      response: string;
      updated_at: string | null;
    }> | null;
  }>;
  pendingReplacements?: Array<{
    id: string;
    shift_id: string;
    requester_name: string;
    reason: string | null;
    event_name: string;
    date: string;
    start_time: string;
  }>;
};

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
export const RECENT_ASSIGNMENT_DAYS = 7;
export const RECENT_RESPONSE_DAYS = 3;
export const STARTING_SOON_DAYS = 7;

export function formatTime(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${period}`;
}

function formatShiftDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function formatDeadline(deadline: string, now: Date, timeZone: string) {
  const remaining = new Date(deadline).getTime() - now.getTime();

  if (remaining <= HOUR) {
    return "Due within the hour";
  }

  if (remaining < DAY) {
    const hours = Math.floor(remaining / HOUR);
    return `Due in ${hours} ${hours === 1 ? "hour" : "hours"}`;
  }

  const formatted = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(new Date(deadline));

  return `Due ${formatted}`;
}

function isWithinDays(timestamp: string | null, now: Date, days: number) {
  if (!timestamp) return false;
  const time = new Date(timestamp).getTime();
  return time <= now.getTime() && now.getTime() - time <= days * DAY;
}

function stripOrder(entry: NotificationItem & { order: string }): NotificationItem {
  return {
    id: entry.id,
    title: entry.title,
    detail: entry.detail,
    href: entry.href,
    tone: entry.tone,
    actionable: entry.actionable,
  };
}

export function buildStaffNotifications(
  input: StaffNotificationInput,
): NotificationItem[] {
  const { now, todayKey, timeZone } = input;
  const tomorrowKey = addDays(todayKey, 1);
  const shiftsById = new Map(input.shifts.map((shift) => [shift.id, shift]));
  const assignedShiftIds = new Set(input.assignments.map((a) => a.shift_id));
  const items: Array<NotificationItem & { order: string }> = [];

  for (const shift of input.shifts) {
    const deadlineTime = new Date(shift.response_deadline).getTime();

    if (
      shift.date < todayKey ||
      assignedShiftIds.has(shift.id) ||
      input.respondedShiftIds.has(shift.id) ||
      !(deadlineTime > now.getTime())
    ) {
      continue;
    }

    const dueSoon = deadlineTime - now.getTime() < 2 * DAY;
    items.push({
      id: `respond:${shift.id}`,
      title: `Respond to ${shift.event_name}`,
      detail: `${formatShiftDate(shift.date)} at ${formatTime(shift.start_time)} · ${formatDeadline(shift.response_deadline, now, timeZone)}`,
      href: `/shifts#shift-${shift.id}`,
      tone: dueSoon ? "amber" : "indigo",
      actionable: true,
      order: `1:${shift.response_deadline}`,
    });
  }

  for (const assignment of input.assignments) {
    const shift = shiftsById.get(assignment.shift_id);

    if (!shift || shift.date < todayKey) {
      continue;
    }

    if (shift.date === todayKey || shift.date === tomorrowKey) {
      items.push({
        id: `soon:${shift.id}`,
        title: `${shift.date === todayKey ? "Today" : "Tomorrow"}: ${shift.event_name}`,
        detail: `Starts at ${formatTime(shift.start_time)} · ${assignment.assigned_role}`,
        href: "/schedule",
        tone: "indigo",
        actionable: false,
        order: `0:${shift.date}:${shift.start_time}`,
      });
    } else if (isWithinDays(assignment.assigned_at, now, RECENT_ASSIGNMENT_DAYS)) {
      items.push({
        id: `assigned:${shift.id}`,
        title: `You're assigned to ${shift.event_name}`,
        detail: `${formatShiftDate(shift.date)} at ${formatTime(shift.start_time)} · ${assignment.assigned_role}`,
        href: "/schedule",
        tone: "emerald",
        actionable: false,
        order: `2:${shift.date}:${shift.start_time}`,
      });
    }
  }

  for (const request of input.resolvedReplacements ?? []) {
    if (
      (request.status !== "approved" && request.status !== "declined") ||
      !isWithinDays(request.resolved_at, now, RECENT_ASSIGNMENT_DAYS)
    ) {
      continue;
    }

    const approved = request.status === "approved";
    const note = request.admin_note ? ` · “${request.admin_note}”` : "";
    items.push({
      id: `replacement:${request.id}`,
      title: approved
        ? `Replacement approved for ${request.event_name}`
        : `Replacement declined for ${request.event_name}`,
      detail: approved
        ? `${formatShiftDate(request.date)} · You're no longer on this shift${note}`
        : `${formatShiftDate(request.date)} · You're still assigned${note}`,
      href: "/schedule",
      tone: approved ? "emerald" : "slate",
      actionable: false,
      order: `2:${request.resolved_at}`,
    });
  }

  return items
    .sort((first, second) => first.order.localeCompare(second.order))
    .map(stripOrder);
}

export function buildAdminNotifications(
  input: AdminNotificationInput,
): NotificationItem[] {
  const { now, todayKey } = input;
  const soonLimit = addDays(todayKey, STARTING_SOON_DAYS - 1);
  const items: Array<NotificationItem & { order: string }> = [];

  for (const request of input.pendingReplacements ?? []) {
    if (request.date < todayKey) {
      continue;
    }

    items.push({
      id: `replacement:${request.id}`,
      title: `${request.requester_name} needs a replacement`,
      detail: `${request.event_name} · ${formatShiftDate(request.date)} at ${formatTime(request.start_time)}${
        request.reason ? ` · “${request.reason}”` : ""
      }`,
      href: `/admin/shifts/${request.shift_id}`,
      tone: "amber",
      actionable: true,
      order: `0:${request.date}:${request.start_time}:a`,
    });
  }

  for (const shift of input.shifts) {
    if (shift.date < todayKey) {
      continue;
    }

    const coverage = calculateShiftCoverage(
      shift.shift_requirements,
      shift.assignments,
    );
    const responses = shift.availability_responses ?? [];
    const deadlinePassed =
      new Date(shift.response_deadline).getTime() <= now.getTime();
    const startingSoon = shift.date <= soonLimit;

    if (coverage.open > 0 && (deadlinePassed || startingSoon)) {
      const yesCount = responses.filter((r) => r.response === "yes").length;
      const reason = deadlinePassed ? "Responses closed" : "Starting soon";
      items.push({
        id: `staff:${shift.id}`,
        title: `Assign staff for ${shift.event_name}`,
        detail: `${formatShiftDate(shift.date)} · ${reason} · ${coverage.open} open ${
          coverage.open === 1 ? "slot" : "slots"
        } · ${yesCount} said yes`,
        href: `/admin/shifts/${shift.id}`,
        tone: "amber",
        actionable: true,
        order: `0:${shift.date}:${shift.start_time}`,
      });
    }

    const recent = responses.filter((r) =>
      isWithinDays(r.updated_at, now, RECENT_RESPONSE_DAYS),
    );

    if (recent.length > 0) {
      const counts = { yes: 0, maybe: 0, no: 0 };
      for (const response of recent) {
        if (response.response in counts) {
          counts[response.response as keyof typeof counts] += 1;
        }
      }
      const parts = (["yes", "maybe", "no"] as const)
        .filter((key) => counts[key] > 0)
        .map((key) => `${counts[key]} ${key}`);

      items.push({
        id: `responses:${shift.id}`,
        title: `${recent.length} new ${recent.length === 1 ? "response" : "responses"} for ${shift.event_name}`,
        detail: `${formatShiftDate(shift.date)} · ${parts.join(" · ")}`,
        href: `/admin/shifts/${shift.id}`,
        tone: "slate",
        actionable: false,
        order: `1:${shift.date}:${shift.start_time}`,
      });
    }
  }

  return items
    .sort((first, second) => first.order.localeCompare(second.order))
    .map(stripOrder);
}
