const AVATAR_BUCKET = "avatars";

export function getAvatarUrl(avatarPath: string | null) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!avatarPath || !supabaseUrl) {
    return null;
  }

  const encodedPath = avatarPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `${supabaseUrl}/storage/v1/object/public/${AVATAR_BUCKET}/${encodedPath}`;
}

