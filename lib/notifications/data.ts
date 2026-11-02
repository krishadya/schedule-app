import "server-only";

import { cache } from "react";

import type { ProfileRole } from "@/lib/auth/profile";
import { APP_TIME_ZONE, getAppDateKey } from "@/lib/date";
import {
  buildAdminNotifications,
  buildStaffNotifications,
  type NotificationItem,
} from "@/lib/notifications/build";
import { createClient } from "@/lib/supabase/server";

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
  const [responsesResult, assignmentsResult] = await Promise.all([
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
  ]);

  if (responsesResult.error || assignmentsResult.error) {
    throw new Error("Unable to load notifications.");
  }

  return buildStaffNotifications({
    now,
    todayKey,
    timeZone: APP_TIME_ZONE,
    shifts,
    respondedShiftIds: new Set(responsesResult.data.map((row) => row.shift_id)),
    assignments: assignmentsResult.data,
  });
}

async function loadAdminNotifications(now: Date, todayKey: string) {
  const supabase = await createClient();
  const { data: shifts, error } = await supabase
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
    .gte("date", todayKey);

  if (error) {
    throw new Error("Unable to load notifications.");
  }

  return buildAdminNotifications({
    now,
    todayKey,
    timeZone: APP_TIME_ZONE,
    shifts,
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
