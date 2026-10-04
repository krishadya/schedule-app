import "server-only";

import type { ReactNode } from "react";

import { getAuthenticatedProfile } from "@/lib/auth/profile";
import { AuthenticatedHeader } from "./authenticated-header";

export default async function AuthenticatedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const profile = await getAuthenticatedProfile();

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <AuthenticatedHeader role={profile.role} />
      {/* The shell owns viewport height, including the shared header. */}
      <div className="flex-1 [&>main]:min-h-0">{children}</div>
    </div>
  );
}
