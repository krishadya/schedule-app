import { redirect } from "next/navigation";

import { getAvatarUrl } from "@/lib/profile/avatar";
import { createClient } from "@/lib/supabase/server";

export type ProfileRole = "admin" | "staff";

export type AuthenticatedProfile = {
  id: string;
  full_name: string;
  username: string;
  role: ProfileRole;
  avatar_path: string | null;
  avatar_url: string | null;
};

export async function getAuthenticatedProfile(): Promise<AuthenticatedProfile> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();

  if (!claimsData?.claims) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", claimsData.claims.sub)
    .single();

  if (
    error ||
    !profile ||
    typeof profile.id !== "string" ||
    typeof profile.full_name !== "string" ||
    typeof profile.username !== "string" ||
    (profile.role !== "admin" && profile.role !== "staff")
  ) {
    throw new Error("Unable to load the authenticated user profile.");
  }

  const avatarPath =
    typeof profile.avatar_path === "string" ? profile.avatar_path : null;

  return {
    id: profile.id,
    full_name: profile.full_name,
    username: profile.username,
    role: profile.role,
    avatar_path: avatarPath,
    avatar_url: getAvatarUrl(avatarPath),
  };
}
