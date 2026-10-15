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
    <div className="min-h-screen lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <AuthenticatedHeader profile={profile} />
      <div className="min-w-0 pb-20 lg:col-start-2 lg:row-start-1 lg:pb-0">
        {children}
      </div>
    </div>
  );
}
