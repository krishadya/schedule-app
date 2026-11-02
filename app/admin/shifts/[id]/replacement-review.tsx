"use client";

import { useActionState } from "react";

import type { ReplacementActionState } from "@/lib/replacements/shared";
import { resolveReplacementRequest } from "./replacement-actions";

const initialState: ReplacementActionState = { status: "idle", message: null };

export function ReplacementReview({
  requestId,
  shiftId,
  reason,
}: {
  requestId: string;
  shiftId: string;
  reason: string | null;
}) {
  const [state, formAction, isPending] = useActionState(
    resolveReplacementRequest,
    initialState,
  );

  return (
    <form
      action={formAction}
      className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 sm:p-4"
    >
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="shiftId" value={shiftId} />
      <p className="text-sm font-semibold text-amber-900">
        Requested a replacement
      </p>
      <p className="mt-0.5 text-sm text-amber-800">
        {reason ? `“${reason}”` : "No reason given."}
      </p>
      <label htmlFor={`admin-note-${requestId}`} className="sr-only">
        Note to staff member (optional)
      </label>
      <input
        id={`admin-note-${requestId}`}
        name="adminNote"
        maxLength={500}
        placeholder="Optional note to the staff member"
        className="form-input mt-3 bg-white"
      />
      <fieldset
        disabled={isPending}
        className="mt-3 flex flex-col gap-2 sm:flex-row"
      >
        <button
          type="submit"
          name="decision"
          value="approve"
          className="btn btn-primary"
        >
          Approve &amp; Remove Assignment
        </button>
        <button
          type="submit"
          name="decision"
          value="decline"
          className="btn btn-secondary"
        >
          Decline
        </button>
      </fieldset>
      {state.message ? (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={`mt-3 ${state.status === "error" ? "alert-error" : "alert-success"}`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
