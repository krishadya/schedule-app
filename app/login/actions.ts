"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { usernameToLoginEmail } from "@/lib/auth/login-email";

export type LoginState = {
  error: string | null;
};

export async function login(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const username = formData.get("username");
  const password = formData.get("password");

  if (
    typeof username !== "string" ||
    username.trim().length === 0 ||
    typeof password !== "string" ||
    password.length === 0
  ) {
    return { error: "Username and password are required." };
  }

  const normalizedUsername = username.trim().toLowerCase();

  if (!/^[a-z0-9._-]+$/.test(normalizedUsername)) {
    return {
      error:
        "Username may only contain letters, numbers, underscores, dots, and hyphens.",
    };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: usernameToLoginEmail(normalizedUsername),
      password,
    });

    if (error) {
      return { error: "Invalid username or password." };
    }
  } catch {
    return {
      error: "Unable to sign in right now. Please try again.",
    };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
