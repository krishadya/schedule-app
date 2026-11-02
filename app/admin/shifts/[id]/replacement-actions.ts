"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getAuthenticatedProfile } from "@/lib/auth/profile";
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

export async function resolveReplacementRequest(
  _previousState: ReplacementActionState,
  formData: FormData,
): Promise<ReplacementActionState> {
  const profile = await getAuthenticatedProfile();

  if (profile.role !== "admin") {
    redirect("/dashboard");
  }

  const requestId = getTextValue(formData, "requestId");
  const shiftId = getTextValue(formData, "shiftId");
  const decision = getTextValue(formData, "decision");
  const note = getTextValue(formData, "adminNote");

  if (!UUID_PATTERN.test(requestId) || !UUID_PATTERN.test(shiftId)) {
    return errorState("Select a valid request and try again.");
  }

  if (decision !== "approve" && decision !== "decline") {
    return errorState("Choose approve or decline.");
  }

  if (note.length > REPLACEMENT_TEXT_LIMIT) {
    return errorState(`Keep the note under ${REPLACEMENT_TEXT_LIMIT} characters.`);
  }

  const supabase = await createClient();
  // One atomic database call: updates the request and, when approving,
  // removes the assignment. Admin RLS policies still apply.
  const { error } = await supabase.rpc("resolve_replacement_request", {
    p_request_id: requestId,
    p_approve: decision === "approve",
    p_admin_note: note || null,
  });

  revalidatePath(`/admin/shifts/${shiftId}`);
  revalidatePath("/admin/shifts");
  revalidatePath("/notifications");
  revalidatePath("/schedule");
  revalidatePath("/dashboard");

  if (error) {
    if (isMissingReplacementSchema(error)) {
      return errorState(NOT_SET_UP_MESSAGE);
    }

    if (error.code === "22023") {
      return errorState("This request has already been resolved.");
    }

    return errorState("The request could not be updated. Please try again.");
  }

  return {
    status: "success",
    message:
      decision === "approve"
        ? "Approved. The assignment was removed, so the slot is open again."
        : "Declined. The staff member stays assigned.",
  };
}
