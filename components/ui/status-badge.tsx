import type { ReactNode } from "react";

const toneClasses = {
  indigo: "border-indigo-200 bg-indigo-50 text-indigo-700",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  amber: "border-amber-200 bg-amber-50 text-amber-800",
  rose: "border-rose-200 bg-rose-50 text-rose-700",
  slate: "border-slate-200 bg-slate-100 text-slate-600",
};

export function StatusBadge({
  tone = "slate",
  children,
}: {
  tone?: keyof typeof toneClasses;
  children: ReactNode;
}) {
  return <span className={`status-badge ${toneClasses[tone]}`}>{children}</span>;
}
