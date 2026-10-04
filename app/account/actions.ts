"use server";

import "server-only";

import { getAuthenticatedProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

export type ChangePasswordActionState = {
  status: "idle" | "success" | "error";
  message: string | null;
};

const MINIMUM_PASSWORD_LENGTH = 8;

function getTextValue(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

function errorState(message: string): ChangePasswordActionState {
  return { status: "error", message };
}

export async function changePassword(
  _previousState: ChangePasswordActionState,
  formData: FormData,
): Promise<ChangePasswordActionState> {
  await getAuthenticatedProfile();

  const newPassword = getTextValue(formData, "newPassword");
  const confirmNewPassword = getTextValue(formData, "confirmNewPassword");

  if (!newPassword || !confirmNewPassword) {
    return errorState("Both password fields are required.");
  }

  if (newPassword.length < MINIMUM_PASSWORD_LENGTH) {
    return errorState(
      `New password must be at least ${MINIMUM_PASSWORD_LENGTH} characters.`,
    );
  }

  if (newPassword !== confirmNewPassword) {
    return errorState("Passwords do not match.");
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      return errorState("Password could not be changed. Please try again.");
    }
  } catch {
    return errorState("Password could not be changed. Please try again.");
  }

  return {
    status: "success",
    message: "Password changed successfully.",
  };
}
