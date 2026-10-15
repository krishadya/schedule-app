"use client";

import { useState } from "react";

const sizeClasses = {
  sm: "h-9 w-9 text-sm",
  md: "h-12 w-12 text-base",
  lg: "h-20 w-20 text-xl",
};

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "?";
}

export function UserAvatar({
  name,
  src,
  size = "md",
}: {
  name: string;
  src: string | null;
  size?: keyof typeof sizeClasses;
}) {
  const [failed, setFailed] = useState(false);
  const className = `${sizeClasses[size]} shrink-0 overflow-hidden rounded-full bg-indigo-100 font-bold text-indigo-700 ring-2 ring-white`;

  if (src && !failed) {
    return (
      // Supabase Storage URLs are generated from a server-validated path.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={`${name}'s profile picture`}
        className={`${className} object-cover`}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span aria-label={`${name}'s initials`} className={`inline-flex items-center justify-center ${className}`}>
      {getInitials(name)}
    </span>
  );
}

