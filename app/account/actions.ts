"use server";

import "server-only";

import { revalidatePath } from "next/cache";

import { getAuthenticatedProfile } from "@/lib/auth/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type ChangePasswordActionState = {
  status: "idle" | "success" | "error";
  message: string | null;
};

export type UpdateProfileActionState = ChangePasswordActionState;

const MINIMUM_PASSWORD_LENGTH = 8;
const MAXIMUM_AVATAR_SIZE = 786_432;
const MAXIMUM_FULL_NAME_LENGTH = 100;
const MAXIMUM_USERNAME_LENGTH = 50;
const USERNAME_PATTERN = /^[a-z0-9._-]+$/;
const AVATAR_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function getTextValue(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

function errorState(message: string): ChangePasswordActionState {
  return { status: "error", message };
}

async function removeAvatar(path: string) {
  try {
    const supabase = await createClient();
    await supabase.storage.from("avatars").remove([path]);
  } catch {
    // A failed cleanup must not expose provider details or undo a saved profile.
  }
}

export async function updateProfile(
  _previousState: UpdateProfileActionState,
  formData: FormData,
): Promise<UpdateProfileActionState> {
  const profile = await getAuthenticatedProfile();
  const fullName = getTextValue(formData, "fullName").trim();
  const username = getTextValue(formData, "username").trim().toLowerCase();
  const removeCurrentAvatar = formData.get("removeAvatar") === "on";
  const avatarValue = formData.get("avatar");
  const avatar = avatarValue instanceof File && avatarValue.size > 0
    ? avatarValue
    : null;

  if (!fullName) {
    return errorState("Full name is required.");
  }

  if (fullName.length > MAXIMUM_FULL_NAME_LENGTH) {
    return errorState(
      `Full name must be ${MAXIMUM_FULL_NAME_LENGTH} characters or fewer.`,
    );
  }

  if (!username) {
    return errorState("Username is required.");
  }

  if (
    username.length > MAXIMUM_USERNAME_LENGTH ||
    !USERNAME_PATTERN.test(username)
  ) {
    return errorState(
      "Username may only contain lowercase letters, numbers, underscores, dots, and hyphens.",
    );
  }

  const avatarExtension = avatar ? AVATAR_EXTENSIONS[avatar.type] : null;

  if (avatar && !avatarExtension) {
    return errorState("Profile pictures must be JPG, PNG, or WebP files.");
  }

  if (avatar && avatar.size > MAXIMUM_AVATAR_SIZE) {
    return errorState("Profile pictures must be 768 KB or smaller.");
  }

  const supabase = await createClient();
  let nextAvatarPath = removeCurrentAvatar ? null : profile.avatar_path;
  let uploadedAvatarPath: string | null = null;

  if (avatar && avatarExtension) {
    uploadedAvatarPath = `${profile.id}/avatar-${Date.now()}.${avatarExtension}`;
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(uploadedAvatarPath, avatar, {
        cacheControl: "3600",
        contentType: avatar.type,
        upsert: false,
      });

    if (uploadError) {
      return errorState("The profile picture could not be uploaded. Please try again.");
    }

    nextAvatarPath = uploadedAvatarPath;
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      username,
      avatar_path: nextAvatarPath,
    })
    .eq("id", profile.id);

  if (profileError) {
    if (uploadedAvatarPath) {
      await removeAvatar(uploadedAvatarPath);
    }

    if (profileError.code === "23505") {
      return errorState("That username is already in use.");
    }

    return errorState("Your profile could not be updated. Please try again.");
  }

  if (username !== profile.username) {
    let authUpdateError: { code?: string } | null = null;

    try {
      const adminSupabase = createAdminClient();
      const { error } = await adminSupabase.auth.admin.updateUserById(
        profile.id,
        {
          email: `${username}@vernon.local`,
          email_confirm: true,
          user_metadata: {
            username,
            full_name: fullName,
          },
        },
      );
      authUpdateError = error;
    } catch {
      authUpdateError = {};
    }

    if (authUpdateError) {
      await supabase
        .from("profiles")
        .update({
          full_name: profile.full_name,
          username: profile.username,
          avatar_path: profile.avatar_path,
        })
        .eq("id", profile.id);

      if (uploadedAvatarPath) {
        await removeAvatar(uploadedAvatarPath);
      }

      if (
        authUpdateError.code === "email_exists" ||
        authUpdateError.code === "user_already_exists"
      ) {
        return errorState("That username is already in use.");
      }

      return errorState("Your username could not be updated. Please try again.");
    }
  }

  if (
    profile.avatar_path &&
    profile.avatar_path !== nextAvatarPath
  ) {
    await removeAvatar(profile.avatar_path);
  }

  revalidatePath("/", "layout");

  return {
    status: "success",
    message: "Profile updated successfully.",
  };
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
