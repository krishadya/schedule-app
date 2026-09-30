"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getAuthenticatedProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

export type AssignmentActionState = {
  error: string | null;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getTextValue(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function errorState(error: string): AssignmentActionState {
  return { error };
}

async function getAdminProfile() {
  const profile = await getAuthenticatedProfile();

  if (profile.role !== "admin") {
    redirect("/dashboard");
  }

  return profile;
}

export async function assignStaff(
  _previousState: AssignmentActionState,
  formData: FormData,
): Promise<AssignmentActionState> {
  const admin = await getAdminProfile();
  const shiftId = getTextValue(formData, "shiftId");
  const userId = getTextValue(formData, "userId");
  const assignedRole = getTextValue(formData, "assignedRole");

  if (!UUID_PATTERN.test(shiftId) || !UUID_PATTERN.test(userId)) {
    return errorState("The shift or staff member is invalid.");
  }

  if (!assignedRole) {
    return errorState("Select a role before assigning this staff member.");
  }

  const supabase = await createClient();
  const [shiftResult, staffResult, requirementResult] = await Promise.all([
    supabase.from("shifts").select("id").eq("id", shiftId).maybeSingle(),
    supabase
      .from("profiles")
      .select("id, role")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("shift_requirements")
      .select("role, staff_needed")
      .eq("shift_id", shiftId)
      .eq("role", assignedRole)
      .maybeSingle(),
  ]);

  if (shiftResult.error || staffResult.error || requirementResult.error) {
    return errorState("The assignment could not be validated. Please try again.");
  }

  if (!shiftResult.data) {
    return errorState("The selected shift does not exist.");
  }

  if (!staffResult.data || staffResult.data.role !== "staff") {
    return errorState("The selected user is not an active staff member.");
  }

  if (!requirementResult.data) {
    return errorState("The selected role is not required for this shift.");
  }

  const [existingAssignmentResult, capacityResult] = await Promise.all([
    supabase
      .from("assignments")
      .select("id")
      .eq("shift_id", shiftId)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("assignments")
      .select("id", { count: "exact", head: true })
      .eq("shift_id", shiftId)
      .eq("assigned_role", requirementResult.data.role),
  ]);

  if (existingAssignmentResult.error || capacityResult.error) {
    return errorState("The current assignments could not be checked.");
  }

  if (existingAssignmentResult.data) {
    return errorState(
      "This staff member is already assigned. Remove that assignment first.",
    );
  }

  if (
    (capacityResult.count ?? 0) >= requirementResult.data.staff_needed
  ) {
    return errorState(`${requirementResult.data.role} is already fully staffed.`);
  }

  const { data: assignment, error: insertError } = await supabase
    .from("assignments")
    .insert({
      shift_id: shiftId,
      user_id: userId,
      assigned_role: requirementResult.data.role,
      assigned_by: admin.id,
    })
    .select("id")
    .single();

  if (insertError || !assignment) {
    if (insertError?.code === "23505") {
      return errorState(
        "This staff member is already assigned. Remove that assignment first.",
      );
    }

    return errorState("The assignment could not be saved. Please try again.");
  }

  const { data: roleAssignments, error: verificationError } = await supabase
    .from("assignments")
    .select("id")
    .eq("shift_id", shiftId)
    .eq("assigned_role", requirementResult.data.role)
    .order("assigned_at", { ascending: true })
    .order("id", { ascending: true });

  if (verificationError) {
    await supabase.from("assignments").delete().eq("id", assignment.id);

    return errorState("The assignment could not be confirmed. Please try again.");
  }

  const retainedAssignmentIds = new Set(
    roleAssignments
      .slice(0, requirementResult.data.staff_needed)
      .map((roleAssignment) => roleAssignment.id),
  );

  if (!retainedAssignmentIds.has(assignment.id)) {
    await supabase.from("assignments").delete().eq("id", assignment.id);

    return errorState(`${requirementResult.data.role} is already fully staffed.`);
  }

  revalidatePath(`/admin/shifts/${shiftId}`);

  return { error: null };
}

export async function removeAssignment(
  _previousState: AssignmentActionState,
  formData: FormData,
): Promise<AssignmentActionState> {
  await getAdminProfile();

  const shiftId = getTextValue(formData, "shiftId");
  const userId = getTextValue(formData, "userId");

  if (!UUID_PATTERN.test(shiftId) || !UUID_PATTERN.test(userId)) {
    return errorState("The shift or staff member is invalid.");
  }

  const supabase = await createClient();
  const [shiftResult, staffResult] = await Promise.all([
    supabase.from("shifts").select("id").eq("id", shiftId).maybeSingle(),
    supabase
      .from("profiles")
      .select("id, role")
      .eq("id", userId)
      .maybeSingle(),
  ]);

  if (shiftResult.error || staffResult.error) {
    return errorState("The assignment could not be validated. Please try again.");
  }

  if (!shiftResult.data) {
    return errorState("The selected shift does not exist.");
  }

  if (!staffResult.data || staffResult.data.role !== "staff") {
    return errorState("The selected user is not an active staff member.");
  }

  const { data: assignment, error: assignmentError } = await supabase
    .from("assignments")
    .select("id")
    .eq("shift_id", shiftId)
    .eq("user_id", userId)
    .maybeSingle();

  if (assignmentError) {
    return errorState("The current assignment could not be checked.");
  }

  if (!assignment) {
    revalidatePath(`/admin/shifts/${shiftId}`);

    return errorState("This staff member is not currently assigned.");
  }

  const { data: deletedAssignment, error: deleteError } = await supabase
    .from("assignments")
    .delete()
    .eq("id", assignment.id)
    .eq("shift_id", shiftId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();

  if (deleteError || !deletedAssignment) {
    return errorState("The assignment could not be removed. Please try again.");
  }

  revalidatePath(`/admin/shifts/${shiftId}`);

  return { error: null };
}
