"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthenticatedProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { parseShiftForm } from "@/lib/shifts/validation";

export type ActionState = {
  error: string | null;
};

export async function createShift(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const profile = await getAuthenticatedProfile();

  if (profile.role !== "admin") {
    redirect("/dashboard");
  }

  const parsed = parseShiftForm(formData);

  if (!parsed.success) {
    return { error: parsed.error };
  }

  const { eventName, date, startTime, endTime, location, notes, parsedDeadline, parsedRequirements } = parsed.data;

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
