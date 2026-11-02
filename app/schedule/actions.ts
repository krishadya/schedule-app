"use server";

import { revalidatePath } from "next/cache";

import { getAuthenticatedProfile } from "@/lib/auth/profile";
import { getAppDateKey } from "@/lib/date";
import {
  NOT_SET_UP_MESSAGE,
  REPLACEMENT_TEXT_LIMIT,
  UUID_PATTERN,
  isMissingReplacementSchema,
  type ReplacementActionState,
} from "@/lib/replacements/shared";
import { createClient } from "@/lib/supabase/server";

function getTextValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function errorState(message: string): ReplacementActionState {
  return { status: "error", message };
}

function revalidateReplacementPages(shiftId: string) {
  revalidatePath("/schedule");
  revalidatePath("/notifications");
  revalidatePath(`/admin/shifts/${shiftId}`);
}

export async function requestReplacement(
  _previousState: ReplacementActionState,
  formData: FormData,
): Promise<ReplacementActionState> {
  const profile = await getAuthenticatedProfile();
  const shiftId = getTextValue(formData, "shiftId");
  const reason = getTextValue(formData, "reason");

  if (!UUID_PATTERN.test(shiftId)) {
    return errorState("Select a valid shift and try again.");
  }

  if (reason.length > REPLACEMENT_TEXT_LIMIT) {
    return errorState(`Keep the reason under ${REPLACEMENT_TEXT_LIMIT} characters.`);
  }

  const supabase = await createClient();
  const [shiftResult, assignmentResult] = await Promise.all([
    supabase.from("shifts").select("id, date").eq("id", shiftId).maybeSingle(),
    supabase
      .from("assignments")
      .select("id")
      .eq("shift_id", shiftId)
      .eq("user_id", profile.id)
      .maybeSingle(),
  ]);

  if (shiftResult.error || assignmentResult.error) {
    return errorState("The request could not be checked. Please try again.");
  }

  if (!shiftResult.data || !assignmentResult.data) {
    return errorState("You are no longer assigned to this shift.");
  }

  if (shiftResult.data.date < getAppDateKey()) {
    return errorState("This shift has already happened.");
  }

  const { error } = await supabase.from("replacement_requests").insert({
    shift_id: shiftId,
    requested_by: profile.id,
    reason: reason || null,
  });

  if (error) {
    if (isMissingReplacementSchema(error)) {
      return errorState(NOT_SET_UP_MESSAGE);
    }

    if (error.code === "23505") {
      revalidateReplacementPages(shiftId);
      return errorState("You already have a pending request for this shift.");
    }

    return errorState("The request could not be sent. Please try again.");
  }

  revalidateReplacementPages(shiftId);
  return { status: "success", message: "Replacement requested." };
}

export async function cancelReplacementRequest(
  _previousState: ReplacementActionState,
  formData: FormData,
): Promise<ReplacementActionState> {
  const profile = await getAuthenticatedProfile();
  const requestId = getTextValue(formData, "requestId");
  const shiftId = getTextValue(formData, "shiftId");

  if (!UUID_PATTERN.test(requestId) || !UUID_PATTERN.test(shiftId)) {
    return errorState("Select a valid request and try again.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("replacement_requests")
    .update({ status: "cancelled", resolved_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("requested_by", profile.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error) {
    return errorState(
      isMissingReplacementSchema(error)
        ? NOT_SET_UP_MESSAGE
        : "The request could not be cancelled. Please try again.",
    );
  }

  revalidateReplacementPages(shiftId);

  if (!data) {
    return errorState("This request was already resolved.");
  }

  return { status: "success", message: "Request cancelled." };
}
