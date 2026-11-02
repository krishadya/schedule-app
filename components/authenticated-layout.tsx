import "server-only";

import type { ReactNode } from "react";

import { getAuthenticatedProfile } from "@/lib/auth/profile";
import { getNotifications } from "@/lib/notifications/data";
import { AuthenticatedHeader } from "./authenticated-header";

export default async function AuthenticatedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const profile = await getAuthenticatedProfile();
  // The badge is a convenience; never let it break the page.
  const notificationCount = await getNotifications(profile.id, profile.role)
    .then((data) => data.actionCount)
    .catch(() => 0);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <AuthenticatedHeader
        profile={profile}
        notificationCount={notificationCount}
      />
      <div className="min-w-0 pb-20 lg:col-start-2 lg:row-start-1 lg:pb-0">
        {children}
      </div>
    </div>
  );
}
