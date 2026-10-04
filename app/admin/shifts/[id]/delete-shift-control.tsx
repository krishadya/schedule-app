"use client";

import { useActionState, useState } from "react";
import { deleteShift } from "./shift-actions";

export function DeleteShiftControl({ shiftId, eventName }: { shiftId: string; eventName: string }) {
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState(deleteShift.bind(null, shiftId), { error: null });

  return (
    <section className="mt-8 rounded-2xl border border-rose-200 bg-rose-50/50 p-5 sm:p-6">
      <h2 className="font-semibold text-rose-950">Delete Shift</h2>
      <p className="mt-1 text-sm text-rose-800/80">
        Permanently remove this shift and its related records.
      </p>
      {confirming ? (
        <form action={action} className="mt-3 space-y-4">
          <p className="text-sm text-slate-700">
            Delete “{eventName}”? This permanently removes the shift, staff requirements,
            availability responses, and assignments. This cannot be undone.
          </p>
          <input type="hidden" name="confirmation" value="delete" />
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={pending}
              className="btn btn-danger">
              {pending ? "Deleting..." : "Confirm Delete"}
            </button>
            <button type="button" disabled={pending} onClick={() => setConfirming(false)}
              className="btn btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setConfirming(true)}
          className="btn btn-danger-outline mt-4">
          Delete Shift
        </button>
      )}
      {state.error ? <p role="alert" className="alert-error mt-3">{state.error}</p> : null}
    </section>
  );
}
