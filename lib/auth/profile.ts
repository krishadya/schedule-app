import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type ProfileRole = "admin" | "staff";

export type AuthenticatedProfile = {
  id: string;
  full_name: string;
  username: string;
  role: ProfileRole;
};

export async function getAuthenticatedProfile(): Promise<AuthenticatedProfile> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();

  if (!claimsData?.claims) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, full_name, username, role")
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

  return profile;
}
