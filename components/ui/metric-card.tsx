import type { ReactNode } from "react";

const toneClasses = {
  emerald: "bg-emerald-500",
  indigo: "bg-indigo-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  slate: "bg-slate-400",
};

export function MetricCard({
  label,
  value,
  tone,
  icon,
  description,
}: {
  label: string;
  value: number;
  tone: keyof typeof toneClasses;
  icon?: ReactNode;
  description?: string;
}) {
  return (
    <div className="surface-card flex min-h-20 min-w-0 items-center gap-2.5 p-3 sm:gap-3 sm:p-4">
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white sm:h-9 sm:w-9 ${toneClasses[tone]}`}
      >
        {icon ?? <span className="h-2 w-2 rounded-full bg-white" />}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase leading-4 tracking-[0.06em] text-slate-500 sm:text-xs">
          {label}
        </p>
        <p className="mt-0.5 text-xl font-bold tabular-nums text-slate-950">
          {value}
        </p>
        {description ? (
          <p className="mt-0.5 hidden truncate text-xs text-slate-500 sm:block">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}
