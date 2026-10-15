import Link from "next/link";

import { AppIcon } from "./app-icon";

type ActionCardProps = {
  href: string;
  title: string;
  description: string;
  icon: Parameters<typeof AppIcon>[0]["name"];
};

export function ActionCard({ href, title, description, icon }: ActionCardProps) {
  return (
    <Link href={href} className="surface-card interactive-card group p-5 sm:p-6">
      <div className="flex items-start gap-4">
        <span className="icon-tile transition-colors group-hover:bg-indigo-100">
          <AppIcon name={icon} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-950">{title}</h3>
            <AppIcon
              name="arrow"
              className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-indigo-600"
            />
          </div>
          <p className="mt-1.5 text-sm leading-6 text-slate-600">{description}</p>
        </div>
      </div>
    </Link>
  );
}
