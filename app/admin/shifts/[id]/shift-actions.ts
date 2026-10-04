"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getAuthenticatedProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { parseShiftForm } from "@/lib/shifts/validation";
import { validateAssignedRoles } from "@/lib/shifts/assignment-validation";
import type { ActionState } from "../actions";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function requireAdmin() {
  const profile = await getAuthenticatedProfile();
  if (profile.role !== "admin") redirect("/dashboard");
}

function refreshShiftPages(id: string) {
  revalidatePath("/admin/shifts");
  revalidatePath(`/admin/shifts/${id}`);
  revalidatePath(`/admin/shifts/${id}/edit`);
  revalidatePath("/shifts");
  revalidatePath("/schedule");
}

export async function editShift(
  id: string,
  expectedUpdatedAt: string | null,
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  if (!UUID_PATTERN.test(id)) return { error: "The shift is invalid." };

  const parsed = parseShiftForm(formData);
  if (!parsed.success) return { error: parsed.error };
  const { eventName, date, startTime, endTime, location, notes, parsedDeadline, parsedRequirements } = parsed.data;
  const requirements = parsedRequirements.requirements;
  const supabase = await createClient();

  const { data: original, error: loadError } = await supabase
    .from("shifts")
    .select("event_name, date, start_time, end_time, location, notes, response_deadline, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (loadError) return { error: "The shift could not be loaded. Please try again." };
  if (!original) return { error: "This shift no longer exists." };
  if (original.updated_at !== expectedUpdatedAt) {
    return { error: "This shift has changed. Reload the edit page before saving." };
  }

  const { data: originalRequirements, error: requirementsError, count } = await supabase
    .from("shift_requirements")
    .select("id, shift_id, role, staff_needed", { count: "exact" })
    .eq("shift_id", id);
  if (requirementsError || !originalRequirements || count !== originalRequirements.length) {
    return { error: "The staff requirements could not be loaded completely. Please try again." };
  }

  const checkAssignments = async (proposed: typeof requirements) => {
    const { data, error, count } = await supabase.from("assignments")
      .select("assigned_role", { count: "exact" }).eq("shift_id", id);
    if (error || !data || count !== data.length) {
      return "The current assignments could not be checked. Please try again.";
    }
    return validateAssignedRoles(proposed, data);
  };

  const assignmentError = await checkAssignments(requirements);
  if (assignmentError) return { error: assignmentError };

  const existingByRole = new Map(originalRequirements.map((row) => [row.role, row]));
  // IDs come from the database or are generated here, never from the submitted form.
  const replacement = requirements.map((row) => ({
    id: existingByRole.get(row.role)?.id ?? crypto.randomUUID(),
    shift_id: id,
    role: row.role,
    staff_needed: row.staffNeeded,
  }));
  const desiredRoles = new Set(requirements.map((row) => row.role));
  const removedIds = originalRequirements.filter((row) => !desiredRoles.has(row.role)).map((row) => row.id);
  const addedIds = replacement.filter((row) => !existingByRole.has(row.role)).map((row) => row.id);
  let savedVersion: string | null = null;
  let requirementsAttempted = false;

  // PostgREST requests are separate transactions. Compensate on failure, and never
  // claim an atomic transaction or overwrite a newer edit during recovery.
  const restoreOriginal = async () => {
    if (!savedVersion) return false;
    try {
      const current = await supabase.from("shifts").select("updated_at").eq("id", id).maybeSingle();
      if (current.error || current.data?.updated_at !== savedVersion) return false;

      if (requirementsAttempted) {
        const originalRoles = originalRequirements.map((row) => ({ role: row.role, staffNeeded: row.staff_needed }));
        if (await checkAssignments(originalRoles)) return false;
        if (originalRequirements.length > 0) {
          const restored = await supabase.from("shift_requirements")
            .upsert(originalRequirements, { onConflict: "shift_id,role" });
          if (restored.error) return false;
        }
        if (addedIds.length > 0) {
          const removed = await supabase.from("shift_requirements")
            .delete().eq("shift_id", id).in("id", addedIds);
          if (removed.error) return false;
        }
      }
      const restored = await supabase.from("shifts").update({
        event_name: original.event_name,
        date: original.date,
        start_time: original.start_time,
        end_time: original.end_time,
        location: original.location,
        notes: original.notes,
        response_deadline: original.response_deadline,
      })
        .eq("id", id).eq("updated_at", savedVersion).select("id").maybeSingle();
      return !restored.error && restored.data?.id === id;
    } catch {
      return false;
    }
  };

  const failedSave = async (message: string): Promise<ActionState> => {
    const restored = await restoreOriginal();
    refreshShiftPages(id);
    return { error: restored
      ? `${message} Original values were restored. Reload the edit page before trying again.`
      : "The save could not be completed or fully restored. Review this shift and its requirements before trying again." };
  };

  try {
    let update = supabase.from("shifts").update({
      event_name: eventName, date, start_time: startTime, end_time: endTime,
      location: location || null, notes: notes || null,
      response_deadline: parsedDeadline.toISOString(),
    }).eq("id", id);
    update = expectedUpdatedAt === null
      ? update.is("updated_at", null)
      : update.eq("updated_at", expectedUpdatedAt);
    const saved = await update.select("updated_at").maybeSingle();
    if (saved.error) return { error: "The shift could not be saved. Reload the page and try again." };
    if (!saved.data) return { error: "This shift changed or was deleted. Reload the page before saving." };
    savedVersion = saved.data.updated_at;

    requirementsAttempted = true;
    // Save the complete desired set in one bulk statement before removing obsolete rows.
    const upserted = await supabase.from("shift_requirements")
      .upsert(replacement, { onConflict: "shift_id,role" });
    if (upserted.error) return await failedSave("Staff requirements could not be saved.");

    const latestAssignmentError = await checkAssignments(requirements);
    if (latestAssignmentError) return await failedSave(latestAssignmentError);

    if (removedIds.length > 0) {
      const removed = await supabase.from("shift_requirements")
        .delete().eq("shift_id", id).in("id", removedIds);
      if (removed.error) return await failedSave("Obsolete staff requirements could not be removed.");
    }

    const finalAssignmentError = await checkAssignments(requirements);
    if (finalAssignmentError) return await failedSave(finalAssignmentError);
  } catch {
    if (savedVersion) return await failedSave("The shift could not be saved.");
    return { error: "The save could not be confirmed. Reload the page and review the shift before trying again." };
  }

  refreshShiftPages(id);
  redirect(`/admin/shifts/${id}`);
}

export async function deleteShift(
  id: string,
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  if (!UUID_PATTERN.test(id)) return { error: "The shift is invalid." };
  if (formData.get("confirmation") !== "delete") {
    return { error: "Confirm deletion before deleting this shift." };
  }
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("shifts").delete()
      .eq("id", id).select("id").maybeSingle();
    if (error) return { error: "The shift could not be deleted. Please try again." };
    if (!data) return { error: "This shift no longer exists. Return to the shift list." };
  } catch {
    return { error: "Deletion could not be confirmed. Check the shift list before trying again." };
  }
  refreshShiftPages(id);
  redirect("/admin/shifts");
}
