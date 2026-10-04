"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getAuthenticatedProfile } from "@/lib/auth/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type CreateStaffActionState = {
  status: "idle" | "success" | "error";
  message: string | null;
};

export type ResetStaffPasswordActionState = CreateStaffActionState;

const USERNAME_PATTERN = /^[a-z0-9._-]+$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MINIMUM_PASSWORD_LENGTH = 8;
const DUPLICATE_USER_CODES = new Set(["email_exists", "user_already_exists"]);

function getTextValue(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

function errorState(message: string): CreateStaffActionState {
  return { status: "error", message };
}

export async function createStaffAccount(
  _previousState: CreateStaffActionState,
  formData: FormData,
): Promise<CreateStaffActionState> {
  const authenticatedProfile = await getAuthenticatedProfile();

  if (authenticatedProfile.role !== "admin") {
    redirect("/dashboard");
  }

  const fullName = getTextValue(formData, "fullName").trim();
  const username = getTextValue(formData, "username").trim().toLowerCase();
  const password = getTextValue(formData, "password");

  if (!fullName) {
    return errorState("Full name is required.");
  }

  if (!username) {
    return errorState("Username is required.");
  }

  if (!USERNAME_PATTERN.test(username)) {
    return errorState(
      "Username may only contain lowercase letters, numbers, underscores, dots, and hyphens.",
    );
  }

  if (!password) {
    return errorState("Temporary password is required.");
  }

  if (password.length < MINIMUM_PASSWORD_LENGTH) {
    return errorState(
      `Temporary password must be at least ${MINIMUM_PASSWORD_LENGTH} characters.`,
    );
  }

  let adminSupabase;

  try {
    adminSupabase = createAdminClient();
  } catch {
    return errorState("Staff account creation is not configured on the server.");
  }

  try {
    const supabase = await createClient();
    const { data: existingProfile, error: lookupError } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (lookupError) {
      return errorState("The username could not be checked. Please try again.");
    }

    if (existingProfile) {
      return errorState("That username is already in use.");
    }

    const { error: createError } = await adminSupabase.auth.admin.createUser({
      email: `${username}@vernon.local`,
      password,
      email_confirm: true,
      user_metadata: {
        username,
        full_name: fullName,
      },
    });

    if (createError) {
      if (
        createError.code &&
        DUPLICATE_USER_CODES.has(createError.code)
      ) {
        return errorState("That username is already in use.");
      }

      if (createError.code === "weak_password") {
        return errorState(
          "The temporary password does not meet the configured password requirements.",
        );
      }

      return errorState("The staff account could not be created. Please try again.");
    }
  } catch {
    return errorState("The staff account could not be created. Please try again.");
  }

  revalidatePath("/admin/staff");

  return {
    status: "success",
    message: `Staff account created for @${username}.`,
  };
}

export async function resetStaffPassword(
  targetUserId: string,
  _previousState: ResetStaffPasswordActionState,
  formData: FormData,
): Promise<ResetStaffPasswordActionState> {
  const authenticatedProfile = await getAuthenticatedProfile();

  if (authenticatedProfile.role !== "admin") {
    redirect("/dashboard");
  }

  if (!UUID_PATTERN.test(targetUserId)) {
    return errorState("The selected staff account is invalid.");
  }

  const newPassword = getTextValue(formData, "newPassword");
  const confirmPassword = getTextValue(formData, "confirmPassword");

  if (!newPassword || !confirmPassword) {
    return errorState("Both password fields are required.");
  }

  if (newPassword.length < MINIMUM_PASSWORD_LENGTH) {
    return errorState(
      `Temporary password must be at least ${MINIMUM_PASSWORD_LENGTH} characters.`,
    );
  }

  if (newPassword !== confirmPassword) {
    return errorState("Passwords do not match.");
  }

  try {
    const supabase = await createClient();
    const { data: targetProfile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", targetUserId)
      .maybeSingle();

    if (profileError) {
      return errorState("The staff account could not be verified. Please try again.");
    }

    if (!targetProfile) {
      return errorState("The selected staff account no longer exists.");
    }

    if (targetProfile.role !== "staff") {
      return errorState("Only staff account passwords can be reset here.");
    }

    let adminSupabase;

    try {
      adminSupabase = createAdminClient();
    } catch {
      return errorState("Password reset is not configured on the server.");
    }

    const { error: updateError } =
      await adminSupabase.auth.admin.updateUserById(targetProfile.id, {
        password: newPassword,
      });

    if (updateError) {
      if (updateError.code === "weak_password") {
        return errorState(
          "The temporary password does not meet the configured password requirements.",
        );
      }

      return errorState("The password could not be reset. Please try again.");
    }
  } catch {
    return errorState("The password could not be reset. Please try again.");
  }

  revalidatePath("/admin/staff");

  return {
    status: "success",
    message: "Password reset successfully.",
  };
}
