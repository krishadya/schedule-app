"use server";

import { revalidatePath } from "next/cache";

import { getAuthenticatedProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

export type AvailabilityResponse = "yes" | "maybe" | "no";

export type AvailabilityActionState = {
  status: "idle" | "success" | "error";
  message: string | null;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;
const VALID_RESPONSES = new Set<AvailabilityResponse>([
  "yes",
  "maybe",
  "no",
]);

function getTextValue(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function isAvailabilityResponse(value: string): value is AvailabilityResponse {
  return VALID_RESPONSES.has(value as AvailabilityResponse);
}

function getTimeInSeconds(value: string) {
  if (!TIME_PATTERN.test(value)) {
    return null;
  }

  const [hours, minutes, seconds = "0"] = value.split(":");

  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

function errorState(message: string): AvailabilityActionState {
  return { status: "error", message };
}

export async function saveAvailability(
  _previousState: AvailabilityActionState,
  formData: FormData,
): Promise<AvailabilityActionState> {
  const profile = await getAuthenticatedProfile();
  const shiftId = getTextValue(formData, "shiftId");
  const response = getTextValue(formData, "response");
  const note = getTextValue(formData, "note");
  const submittedStartTime = getTextValue(formData, "suggestedStartTime");
  const submittedEndTime = getTextValue(formData, "suggestedEndTime");

  if (!UUID_PATTERN.test(shiftId)) {
    return errorState("Select a valid shift and try again.");
  }

  if (!isAvailabilityResponse(response)) {
    return errorState("Select Yes, Maybe, or No.");
  }

  let suggestedStartTime: string | null = null;
  let suggestedEndTime: string | null = null;
  const startTimeInSeconds = submittedStartTime
    ? getTimeInSeconds(submittedStartTime)
    : null;
  const endTimeInSeconds = submittedEndTime
    ? getTimeInSeconds(submittedEndTime)
    : null;

  if (submittedStartTime && startTimeInSeconds === null) {
    return errorState("Enter a valid Available from time.");
  }

  if (submittedEndTime && endTimeInSeconds === null) {
    return errorState("Enter a valid Available until time.");
  }

  if (response === "maybe") {
    if (
      startTimeInSeconds !== null &&
      endTimeInSeconds !== null &&
      endTimeInSeconds <= startTimeInSeconds
    ) {
      return errorState("Available until must be later than Available from.");
    }

    suggestedStartTime = submittedStartTime || null;
    suggestedEndTime = submittedEndTime || null;
  }

  const supabase = await createClient();
  const { data: shift, error: shiftError } = await supabase
    .from("shifts")
    .select("id, response_deadline")
    .eq("id", shiftId)
    .maybeSingle();

  if (shiftError || !shift) {
    return errorState("The selected shift could not be found.");
  }

  const deadline = new Date(shift.response_deadline).getTime();

  if (!Number.isFinite(deadline)) {
    return errorState("The shift response deadline is invalid.");
  }

  if (deadline <= Date.now()) {
    revalidatePath("/shifts");

    return errorState("The response deadline for this shift has passed.");
  }

  const { error } = await supabase.from("availability_responses").upsert(
    {
      shift_id: shift.id,
      user_id: profile.id,
      response,
      suggested_start_time: suggestedStartTime,
      suggested_end_time: suggestedEndTime,
      note: note || null,
    },
    { onConflict: "shift_id,user_id" },
  );

  if (error) {
    return errorState("Your availability could not be saved. Please try again.");
  }

  revalidatePath("/shifts");

  return { status: "success", message: "Availability saved." };
}
