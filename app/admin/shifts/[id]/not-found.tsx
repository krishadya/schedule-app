import Link from "next/link";
import { AppIcon } from "@/components/ui/app-icon";

export default function ShiftNotFound() {
  return (
    <main className="page-shell flex items-center justify-center">
      <div className="surface-card max-w-md p-8 text-center sm:p-10">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
          <AppIcon name="calendar" className="h-6 w-6" />
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-950">
          Shift not found
        </h1>
        <p className="mt-2 text-slate-600">
          This shift does not exist or may have been removed.
        </p>
        <Link
          href="/admin/shifts"
          className="btn btn-primary mt-6"
        >
          Back to Shifts
        </Link>
      </div>
    </main>
  );
}
