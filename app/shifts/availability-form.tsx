"use client";

import { useActionState, useState } from "react";

import {
  saveAvailability,
  type AvailabilityActionState,
  type AvailabilityResponse,
} from "./actions";

export type ExistingAvailability = {
  response: AvailabilityResponse;
  suggestedStartTime: string | null;
  suggestedEndTime: string | null;
  note: string | null;
};

type AvailabilityFormProps = {
  shiftId: string;
  deadlinePassed: boolean;
  initialAvailability: ExistingAvailability | null;
};

const responseOptions: Array<{
  value: AvailabilityResponse;
  label: string;
}> = [
  { value: "yes", label: "Yes" },
  { value: "maybe", label: "Maybe" },
  { value: "no", label: "No" },
];

const initialState: AvailabilityActionState = {
  status: "idle",
  message: null,
};

function formatResponse(response: AvailabilityResponse) {
  return response.charAt(0).toUpperCase() + response.slice(1);
}

function formatTime(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const twelveHour = hours % 12 || 12;

  return `${twelveHour}:${String(minutes).padStart(2, "0")} ${period}`;
}

function responseOptionClasses(
  response: AvailabilityResponse,
  selectedResponse: AvailabilityResponse | null,
) {
  if (response !== selectedResponse) {
    return "border-slate-300 bg-white text-slate-700 hover:bg-slate-50";
  }

  if (response === "yes") {
    return "border-emerald-600 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-600";
  }

  if (response === "maybe") {
    return "border-amber-500 bg-amber-50 text-amber-800 ring-1 ring-amber-500";
  }

  return "border-rose-500 bg-rose-50 text-rose-800 ring-1 ring-rose-500";
}

export function AvailabilityForm({
  shiftId,
  deadlinePassed,
  initialAvailability,
}: AvailabilityFormProps) {
  const [selectedResponse, setSelectedResponse] =
    useState<AvailabilityResponse | null>(
      initialAvailability?.response ?? null,
    );
  const [state, formAction, isPending] = useActionState(
    saveAvailability,
    initialState,
  );

  if (deadlinePassed) {
    return (
      <section className="mt-5 border-t border-slate-100 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">
            Your availability
          </h3>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            Responses closed
          </span>
        </div>

        {initialAvailability ? (
          <div className="mt-3 space-y-2 text-sm text-slate-700">
            <p>
              Response:{" "}
              <span className="font-semibold">
                {formatResponse(initialAvailability.response)}
              </span>
            </p>
            {initialAvailability.response === "maybe" &&
            (initialAvailability.suggestedStartTime ||
              initialAvailability.suggestedEndTime) ? (
              <p>
                Available: {" "}
                {initialAvailability.suggestedStartTime
                  ? formatTime(initialAvailability.suggestedStartTime)
                  : "Not specified"}
                {" – "}
                {initialAvailability.suggestedEndTime
                  ? formatTime(initialAvailability.suggestedEndTime)
                  : "Not specified"}
              </p>
            ) : null}
            {initialAvailability.note ? (
              <p className="whitespace-pre-wrap">{initialAvailability.note}</p>
            ) : null}
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-600">
            No response was submitted before the deadline.
          </p>
        )}
      </section>
    );
  }

  return (
    <form action={formAction} className="mt-5 border-t border-slate-100 pt-4">
      <input type="hidden" name="shiftId" value={shiftId} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">
          Your availability
        </h3>
        <p className="text-xs text-slate-600">
          {initialAvailability
            ? `Saved response: ${formatResponse(initialAvailability.response)}`
            : "No response submitted yet"}
        </p>
      </div>

      <fieldset disabled={isPending} className="mt-3">
        <legend className="sr-only">Choose your availability</legend>
        <div className="grid grid-cols-3 gap-2">
          {responseOptions.map((option) => (
            <label
              key={option.value}
              className={`cursor-pointer rounded-md border px-3 py-2 text-center text-sm font-semibold transition ${responseOptionClasses(option.value, selectedResponse)}`}
            >
              <input
                type="radio"
                name="response"
                value={option.value}
                checked={selectedResponse === option.value}
                onChange={() => setSelectedResponse(option.value)}
                className="sr-only"
              />
              {option.label}
            </label>
          ))}
        </div>

        {selectedResponse === "maybe" ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor={`suggested-start-${shiftId}`}
                className="block text-xs font-medium text-slate-700"
              >
                Available from
              </label>
              <input
                id={`suggested-start-${shiftId}`}
                name="suggestedStartTime"
                type="time"
                defaultValue={
                  initialAvailability?.response === "maybe"
                    ? (initialAvailability.suggestedStartTime?.slice(0, 5) ?? "")
                    : ""
                }
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
            </div>
            <div>
              <label
                htmlFor={`suggested-end-${shiftId}`}
                className="block text-xs font-medium text-slate-700"
              >
                Available until
              </label>
              <input
                id={`suggested-end-${shiftId}`}
                name="suggestedEndTime"
                type="time"
                defaultValue={
                  initialAvailability?.response === "maybe"
                    ? (initialAvailability.suggestedEndTime?.slice(0, 5) ?? "")
                    : ""
                }
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
            </div>
          </div>
        ) : null}

        <div className="mt-4">
          <label
            htmlFor={`availability-note-${shiftId}`}
            className="block text-xs font-medium text-slate-700"
          >
            Note <span className="font-normal text-slate-500">(optional)</span>
          </label>
          <textarea
            id={`availability-note-${shiftId}`}
            name="note"
            rows={2}
            defaultValue={initialAvailability?.note ?? ""}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
          />
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div aria-live="polite" className="text-sm">
            {state.status === "error" ? (
              <p role="alert" className="text-red-700">
                {state.message}
              </p>
            ) : null}
            {state.status === "success" ? (
              <p className="text-emerald-700">{state.message}</p>
            ) : null}
          </div>
          <button
            type="submit"
            disabled={isPending || selectedResponse === null}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending
              ? "Saving..."
              : initialAvailability
                ? "Update Response"
                : "Save Response"}
          </button>
        </div>
      </fieldset>
    </form>
  );
}
