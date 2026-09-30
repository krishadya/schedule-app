import Link from "next/link";

export default function ShiftNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold text-slate-900">
          Shift not found
        </h1>
        <p className="mt-2 text-slate-600">
          This shift does not exist or may have been removed.
        </p>
        <Link
          href="/admin/shifts"
          className="mt-6 inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Back to Shifts
        </Link>
      </div>
    </main>
  );
}
