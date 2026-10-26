"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getAuthenticatedProfile } from "@/lib/auth/profile";
import { isExplicitTimestamp } from "@/lib/shifts/deadline";
import {
  generateRecurringDates,
  validateRecurringShiftDraft,
  type RecurringShiftDraft,
  type Weekday,
} from "@/lib/shifts/recurrence";
import { createClient } from "@/lib/supabase/server";

export type RecurringShiftActionState =
  | { status: "idle"; message: null; count: null }
  | { status: "error"; message: string; count: null }
  | { status: "success"; message: string; count: number };

function getTextValue(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

function parseJsonArray(value: string) {
  try {
    const parsed: unknown = JSON.parse(value);

    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function parseRecurringDraft(formData: FormData):
  | { success: true; draft: RecurringShiftDraft }
  | { success: false; error: string } {
  const submittedDays = parseJsonArray(getTextValue(formData, "selectedDays"));
  const submittedRequirements = parseJsonArray(
    getTextValue(formData, "requirements"),
  );

  if (
    !submittedDays ||
    !submittedDays.every((day) => typeof day === "string")
  ) {
    return { success: false, error: "Select at least one valid weekday." };
  }

  if (!submittedRequirements) {
    return {
      success: false,
      error: "Staff requirements could not be read. Please review them.",
    };
  }

  const requirements = submittedRequirements.map((requirement) => {
    if (
      typeof requirement !== "object" ||
      requirement === null ||
      Array.isArray(requirement)
    ) {
      return { role: "", count: "" };
    }

    const record = requirement as Record<string, unknown>;

    return {
      role: typeof record.role === "string" ? record.role : "",
      count:
        typeof record.count === "string" ||
        typeof record.count === "number"
          ? String(record.count)
          : "",
    };
  });

  return {
    success: true,
    draft: {
      eventName: getTextValue(formData, "eventName"),
      startDate: getTextValue(formData, "startDate"),
      endDate: getTextValue(formData, "endDate"),
      selectedDays: submittedDays as Weekday[],
      startTime: getTextValue(formData, "startTime"),
      endTime: getTextValue(formData, "endTime"),
      location: getTextValue(formData, "location"),
      notes: getTextValue(formData, "notes"),
      responseDeadline: getTextValue(formData, "responseDeadline"),
      requirements,
    },
  };
}

export async function createRecurringShifts(
  _previousState: RecurringShiftActionState,
  formData: FormData,
): Promise<RecurringShiftActionState> {
  const profile = await getAuthenticatedProfile();

  if (profile.role !== "admin") {
    redirect("/dashboard");
  }

  const submitted = parseRecurringDraft(formData);

  if (!submitted.success) {
    return { status: "error", message: submitted.error, count: null };
  }

  const validation = validateRecurringShiftDraft(submitted.draft);

  if (!validation.success) {
    return { status: "error", message: validation.error, count: null };
  }

  const generation = generateRecurringDates(
    validation.data.startDate,
    validation.data.endDate,
    validation.data.selectedDays,
  );

  if (!generation.success) {
    return { status: "error", message: generation.error, count: null };
  }

  if (generation.dates.length === 0) {
    return {
      status: "error",
      message: "No shifts match the selected weekdays within this date range.",
      count: null,
    };
  }

  if (!isExplicitTimestamp(validation.data.responseDeadline)) {
    return {
      status: "error",
      message: "The response deadline must include a timezone.",
      count: null,
    };
  }

  const deadline = new Date(validation.data.responseDeadline);

  if (Number.isNaN(deadline.getTime())) {
    return {
      status: "error",
      message: "Enter a valid response deadline.",
      count: null,
    };
  }

  try {
    const supabase = await createClient();
    const { data: createdCount, error } = await supabase.rpc(
      "create_recurring_shifts",
      {
        p_event_name: validation.data.eventName,
        p_occurrence_dates: generation.dates,
        p_start_time: validation.data.startTime,
        p_end_time: validation.data.endTime,
        p_location: validation.data.location || null,
        p_notes: validation.data.notes || null,
        p_response_deadline: deadline.toISOString(),
        p_requirements: validation.data.requirements.map((requirement) => ({
          role: requirement.role,
          staff_needed: requirement.staffNeeded,
        })),
      },
    );

    if (error) {
      if (error.code === "42501") {
        return {
          status: "error",
          message: "You are not authorized to create recurring shifts.",
          count: null,
        };
      }

      if (error.code === "22023") {
        return {
          status: "error",
          message:
            "The recurring schedule was rejected. Review the form and preview it again.",
          count: null,
        };
      }

      return {
        status: "error",
        message: "The recurring shifts could not be created. Please try again.",
        count: null,
      };
    }

    if (
      typeof createdCount !== "number" ||
      createdCount !== generation.dates.length
    ) {
      revalidatePath("/admin/shifts");

      return {
        status: "error",
        message:
          "The server response could not be verified. Check the shift list before retrying.",
        count: null,
      };
    }

    revalidatePath("/admin/shifts");
    revalidatePath("/dashboard");
    revalidatePath("/shifts");

    return {
      status: "success",
      message: `${createdCount} ${createdCount === 1 ? "shift was" : "shifts were"} created successfully.`,
      count: createdCount,
    };
  } catch {
    revalidatePath("/admin/shifts");

    return {
      status: "error",
      message:
        "The result could not be confirmed. Check the shift list before retrying.",
      count: null,
    };
  }
}
