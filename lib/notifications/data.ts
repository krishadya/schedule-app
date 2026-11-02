import "server-only";

import { cache } from "react";

import type { ProfileRole } from "@/lib/auth/profile";
import { APP_TIME_ZONE, getAppDateKey } from "@/lib/date";
import {
  buildAdminNotifications,
  buildStaffNotifications,
  type NotificationItem,
} from "@/lib/notifications/build";
import { isMissingReplacementSchema } from "@/lib/replacements/shared";
import { createClient } from "@/lib/supabase/server";

type EmbeddedShift = { event_name: string; date: string; start_time: string };

// Supabase types a to-one embed loosely; normalise it to a single object.
function single<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

export type NotificationData = {
  items: NotificationItem[];
  actionCount: number;
};

async function loadStaffNotifications(userId: string, now: Date, todayKey: string) {
  const supabase = await createClient();
  const { data: shifts, error } = await supabase
    .from("shifts")
    .select("id, event_name, date, start_time, response_deadline")
    .gte("date", todayKey);

  if (error) {
    throw new Error("Unable to load notifications.");
  }

  if (shifts.length === 0) {
    return [];
  }

  const shiftIds = shifts.map((shift) => shift.id);
  const [responsesResult, assignmentsResult, replacementsResult] = await Promise.all([
    supabase
      .from("availability_responses")
      .select("shift_id")
      .eq("user_id", userId)
      .in("shift_id", shiftIds),
    supabase
      .from("assignments")
      .select("shift_id, assigned_role, assigned_at")
      .eq("user_id", userId)
      .in("shift_id", shiftIds),
    supabase
      .from("replacement_requests")
      .select("id, status, admin_note, resolved_at, shifts ( event_name, date, start_time )")
      .eq("requested_by", userId)
      .in("status", ["approved", "declined"])
      .in("shift_id", shiftIds),
  ]);

  if (responsesResult.error || assignmentsResult.error) {
    throw new Error("Unable to load notifications.");
  }

  if (
    replacementsResult.error &&
    !isMissingReplacementSchema(replacementsResult.error)
  ) {
    throw new Error("Unable to load notifications.");
  }

  const resolvedReplacements = (replacementsResult.data ?? []).flatMap(
    (request) => {
      const shift = single<EmbeddedShift>(request.shifts);
      return shift
        ? [
            {
              id: request.id,
              status: request.status,
              admin_note: request.admin_note,
              resolved_at: request.resolved_at,
              event_name: shift.event_name,
              date: shift.date,
            },
          ]
        : [];
    },
  );

  return buildStaffNotifications({
    now,
    todayKey,
    timeZone: APP_TIME_ZONE,
    shifts,
    respondedShiftIds: new Set(responsesResult.data.map((row) => row.shift_id)),
    assignments: assignmentsResult.data,
    resolvedReplacements,
  });
}

async function loadAdminNotifications(now: Date, todayKey: string) {
  const supabase = await createClient();
  const [shiftsResult, replacementsResult] = await Promise.all([
    supabase
      .from("shifts")
      .select(
        `
        id,
        event_name,
        date,
        start_time,
        response_deadline,
        shift_requirements ( role, staff_needed ),
        assignments ( assigned_role ),
        availability_responses ( response, updated_at )
      `,
      )
      .gte("date", todayKey),
    supabase
      .from("replacement_requests")
      .select(
        "id, shift_id, reason, shifts ( event_name, date, start_time ), requester:profiles!replacement_requests_requested_by_fkey ( full_name )",
      )
      .eq("status", "pending"),
  ]);

  if (shiftsResult.error) {
    throw new Error("Unable to load notifications.");
  }

  if (
    replacementsResult.error &&
    !isMissingReplacementSchema(replacementsResult.error)
  ) {
    throw new Error("Unable to load notifications.");
  }

  const pendingReplacements = (replacementsResult.data ?? []).flatMap(
    (request) => {
      const shift = single<EmbeddedShift>(request.shifts);
      const requester = single<{ full_name: string }>(request.requester);
      return shift
        ? [
            {
              id: request.id,
              shift_id: request.shift_id,
              requester_name: requester?.full_name ?? "A staff member",
              reason: request.reason,
              event_name: shift.event_name,
              date: shift.date,
              start_time: shift.start_time,
            },
          ]
        : [];
    },
  );

  return buildAdminNotifications({
    now,
    todayKey,
    timeZone: APP_TIME_ZONE,
    shifts: shiftsResult.data,
    pendingReplacements,
  });
}

// Cached per request so the header badge and the page share one load.
export const getNotifications = cache(
  async (userId: string, role: ProfileRole): Promise<NotificationData> => {
    const now = new Date();
    const todayKey = getAppDateKey(now);
    const items =
      role === "admin"
        ? await loadAdminNotifications(now, todayKey)
        : await loadStaffNotifications(userId, now, todayKey);

    return {
      items,
      actionCount: items.filter((item) => item.actionable).length,
    };
  },
);
