"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthenticatedProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

export type ActionState = {
  error: string | null;
};

type ShiftRequirement = {
  role: string;
  staffNeeded: number;
};

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;

function getTextValue(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function isValidDate(value: string) {
  const match = DATE_PATTERN.exec(value);

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsedDate = new Date(Date.UTC(year, month - 1, day));

  return (
    parsedDate.getUTCFullYear() === year &&
    parsedDate.getUTCMonth() === month - 1 &&
    parsedDate.getUTCDate() === day
  );
}

function getTimeInSeconds(value: string) {
  const match = TIME_PATTERN.exec(value);

  if (!match) {
    return null;
  }

  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3] ?? 0);
}

function parseRequirements(rawRequirements: string):
  | { success: true; requirements: ShiftRequirement[] }
  | { success: false; error: string } {
  let submittedRequirements: unknown;

  try {
    submittedRequirements = JSON.parse(rawRequirements);
  } catch {
    return {
      success: false,
      error: "Staff requirements could not be read. Please review them and try again.",
    };
  }

  if (
    !Array.isArray(submittedRequirements) ||
    submittedRequirements.length === 0
  ) {
    return { success: false, error: "Add at least one staff requirement." };
  }

  const roleNames = new Set<string>();
  const requirements: ShiftRequirement[] = [];

  for (const submittedRequirement of submittedRequirements) {
    if (
      typeof submittedRequirement !== "object" ||
      submittedRequirement === null ||
      Array.isArray(submittedRequirement)
    ) {
      return {
        success: false,
        error: "Each staff requirement must include a role and staff count.",
      };
    }

    const requirementRecord = submittedRequirement as Record<string, unknown>;
    const role =
      typeof requirementRecord.role === "string"
        ? requirementRecord.role.trim()
        : "";
    const staffNeeded = requirementRecord.count;

    if (!role) {
      return {
        success: false,
        error: "Each staff requirement must include a role.",
      };
    }

    if (
      typeof staffNeeded !== "number" ||
      !Number.isInteger(staffNeeded) ||
      staffNeeded < 1
    ) {
      return {
        success: false,
        error: "Staff needed must be a whole number of at least 1.",
      };
    }

    const normalizedRole = role.toLowerCase();

    if (roleNames.has(normalizedRole)) {
      return {
        success: false,
        error: "Staff requirement roles must be unique.",
      };
    }

    roleNames.add(normalizedRole);
    requirements.push({ role, staffNeeded });
  }

  return { success: true, requirements };
}

export async function createShift(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const profile = await getAuthenticatedProfile();

  if (profile.role !== "admin") {
    redirect("/dashboard");
  }

  const eventName = getTextValue(formData, "eventName");
  const date = getTextValue(formData, "date");
  const startTime = getTextValue(formData, "startTime");
  const endTime = getTextValue(formData, "endTime");
  const location = getTextValue(formData, "location");
  const responseDeadline = getTextValue(formData, "responseDeadline");
  const notes = getTextValue(formData, "notes");
  const rawRequirements = getTextValue(formData, "requirements");

  if (!eventName || !date || !startTime || !endTime || !responseDeadline) {
    return { error: "Complete all required shift fields." };
  }

  if (!isValidDate(date)) {
    return { error: "Enter a valid shift date." };
  }

  const startTimeInSeconds = getTimeInSeconds(startTime);
  const endTimeInSeconds = getTimeInSeconds(endTime);

  if (startTimeInSeconds === null || endTimeInSeconds === null) {
    return { error: "Enter valid start and end times." };
  }

  if (endTimeInSeconds <= startTimeInSeconds) {
    return { error: "End time must be later than start time." };
  }

  const parsedDeadline = new Date(responseDeadline);

  if (Number.isNaN(parsedDeadline.getTime())) {
    return { error: "Enter a valid response deadline." };
  }

  const parsedRequirements = parseRequirements(rawRequirements);

  if (!parsedRequirements.success) {
    return { error: parsedRequirements.error };
  }

  const supabase = await createClient();
  let createdShiftId: string | null = null;

  const removeIncompleteShift = async () => {
    const shiftId = createdShiftId;

    if (!shiftId) {
      return true;
    }

    try {
      const { data, error } = await supabase
        .from("shifts")
        .delete()
        .eq("id", shiftId)
        .eq("created_by", profile.id)
        .select("id")
        .maybeSingle();

      return error === null && data?.id === shiftId;
    } catch {
      return false;
    }
  };

  try {
    const { data: shift, error: shiftError } = await supabase
      .from("shifts")
      .insert({
        event_name: eventName,
        date,
        start_time: startTime,
        end_time: endTime,
        location: location || null,
        notes: notes || null,
        response_deadline: parsedDeadline.toISOString(),
        created_by: profile.id,
      })
      .select("id")
      .single();

    if (shiftError || !shift) {
      return { error: "The shift could not be created. Please try again." };
    }

    createdShiftId = shift.id;

    const { error: requirementsError } = await supabase
      .from("shift_requirements")
      .insert(
        parsedRequirements.requirements.map((requirement) => ({
          shift_id: createdShiftId,
          role: requirement.role,
          staff_needed: requirement.staffNeeded,
        })),
      );

    if (requirementsError) {
      const cleanupSucceeded = await removeIncompleteShift();

      if (!cleanupSucceeded) {
        revalidatePath("/admin/shifts");

        return {
          error:
            "The staff requirements could not be saved. Review the shift list before trying again.",
        };
      }

      return { error: "The shift could not be created. Please try again." };
    }
  } catch {
    const cleanupSucceeded = await removeIncompleteShift();

    if (!cleanupSucceeded) {
      revalidatePath("/admin/shifts");

      return {
        error:
          "The shift may be incomplete. Review the shift list before trying again.",
      };
    }

    return { error: "The shift could not be created. Please try again." };
  }

  revalidatePath("/admin/shifts");
  redirect("/admin/shifts");
}
