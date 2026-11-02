"use client";

import { useActionState } from "react";

import type {
  ReplacementActionState,
  ReplacementRequest,
} from "@/lib/replacements/shared";
import { cancelReplacementRequest, requestReplacement } from "./actions";

const initialState: ReplacementActionState = { status: "idle", message: null };

function ActionMessage({ state }: { state: ReplacementActionState }) {
  if (!state.message) return null;

  return (
    <p
      role={state.status === "error" ? "alert" : "status"}
      className={`mt-3 ${state.status === "error" ? "alert-error" : "alert-success"}`}
    >
      {state.message}
    </p>
  );
}

function PendingRequest({
  shiftId,
  request,
}: {
  shiftId: string;
  request: ReplacementRequest;
}) {
  const [state, formAction, isPending] = useActionState(
    cancelReplacementRequest,
    initialState,
  );

  return (
    <form
      action={formAction}
      className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4"
    >
      <input type="hidden" name="requestId" value={request.id} />
      <input type="hidden" name="shiftId" value={shiftId} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-amber-900">
            Replacement requested
          </p>
          <p className="mt-0.5 text-sm text-amber-800">
            {request.reason
              ? `“${request.reason}”`
              : "Waiting for a manager to review."}
          </p>
          <p className="mt-1 text-xs text-amber-700">
            You stay on this shift until a manager approves.
          </p>
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="btn btn-secondary self-start"
        >
          {isPending ? "Cancelling..." : "Cancel Request"}
        </button>
      </div>
      <ActionMessage state={state} />
    </form>
  );
}

function NewRequest({
  shiftId,
  declined,
}: {
  shiftId: string;
  declined: ReplacementRequest | null;
}) {
  const [state, formAction, isPending] = useActionState(
    requestReplacement,
    initialState,
  );

  return (
    <div className="mt-4">
      {declined ? (
        <p className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600 ring-1 ring-slate-200">
          Your last replacement request was declined
          {declined.admin_note ? `: “${declined.admin_note}”` : "."}
        </p>
      ) : null}
      <details className="group">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-sm font-semibold text-slate-600 hover:text-slate-900 [&::-webkit-details-marker]:hidden">
          Can&apos;t make it? Request a replacement
          <span aria-hidden="true" className="transition group-open:rotate-90">
            ›
          </span>
        </summary>
        <form action={formAction} className="mt-3">
          <input type="hidden" name="shiftId" value={shiftId} />
          <label htmlFor={`reason-${shiftId}`} className="form-label-small">
            Reason (optional)
          </label>
          <textarea
            id={`reason-${shiftId}`}
            name="reason"
            rows={2}
            maxLength={500}
            className="form-input mt-1"
            placeholder="Let your manager know why"
          />
          <button
            type="submit"
            disabled={isPending}
            className="btn btn-secondary mt-3"
          >
            {isPending ? "Sending..." : "Send Request"}
          </button>
          <ActionMessage state={state} />
        </form>
      </details>
    </div>
  );
}

export function ReplacementControl({
  shiftId,
  latestRequest,
}: {
  shiftId: string;
  latestRequest: ReplacementRequest | null;
}) {
  if (latestRequest?.status === "pending") {
    return <PendingRequest shiftId={shiftId} request={latestRequest} />;
  }

  return (
    <NewRequest
      shiftId={shiftId}
      declined={latestRequest?.status === "declined" ? latestRequest : null}
    />
  );
}
