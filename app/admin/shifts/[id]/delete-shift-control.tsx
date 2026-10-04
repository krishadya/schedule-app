"use client";

import { useActionState, useState } from "react";
import { deleteShift } from "./shift-actions";

export function DeleteShiftControl({ shiftId, eventName }: { shiftId: string; eventName: string }) {
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState(deleteShift.bind(null, shiftId), { error: null });

  return (
    <section className="mt-8 rounded-xl border border-red-200 bg-white p-5">
      <h2 className="font-semibold text-slate-900">Delete Shift</h2>
      {confirming ? (
        <form action={action} className="mt-3 space-y-4">
          <p className="text-sm text-slate-700">
            Delete “{eventName}”? This permanently removes the shift, staff requirements,
            availability responses, and assignments. This cannot be undone.
          </p>
          <input type="hidden" name="confirmation" value="delete" />
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={pending}
              className="rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50">
              {pending ? "Deleting..." : "Confirm Delete"}
            </button>
            <button type="button" disabled={pending} onClick={() => setConfirming(false)}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setConfirming(true)}
          className="mt-3 rounded-md border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">
          Delete Shift
        </button>
      )}
      {state.error ? <p role="alert" className="mt-3 text-sm text-red-700">{state.error}</p> : null}
    </section>
  );
}
