"use client";

import { useActionState, useState } from "react";

import { toAppDateTimeInput } from "@/lib/date";
import Link from "next/link";
import type { ActionState } from "./actions";
import {
  StaffRequirementsFieldset,
  type EditableStaffRequirement,
} from "./staff-requirements-fieldset";

type StaffRequirement = {
  id: string;
  role: string;
  count: number;
};

const initialState: ActionState = { error: null };

export type ShiftFormValues = {
  eventName: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  responseDeadline: string;
  notes: string;
  requirements: StaffRequirement[];
};

type EditableShiftFields = Omit<ShiftFormValues, "requirements">;

export function ShiftForm({ action, initialValues, initialDate, cancelHref = "/admin/shifts", mode }: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  initialValues?: ShiftFormValues;
  initialDate?: string;
  cancelHref?: string;
  mode?: "create" | "edit";
}) {
  const isEditing = mode ? mode === "edit" : !!initialValues;
  const [fields, setFields] = useState<EditableShiftFields>(() => ({
    eventName: initialValues?.eventName ?? "",
    date: initialValues?.date ?? initialDate ?? "",
    startTime: initialValues?.startTime ?? "",
    endTime: initialValues?.endTime ?? "",
    location: initialValues?.location ?? "",
    responseDeadline: initialValues
      ? toAppDateTimeInput(initialValues.responseDeadline)
      : "",
    notes: initialValues?.notes ?? "",
  }));
  const [requirements, setRequirements] = useState<EditableStaffRequirement[]>(
    () =>
      initialValues?.requirements.map((requirement) => ({
        ...requirement,
        count: String(requirement.count),
      })) ?? [{ id: "initial-requirement", role: "", count: "1" }],
  );
  const [state, formAction, isPending] = useActionState(
    async (previousState: ActionState, formData: FormData) => {
      // Datetime-local has no zone, so submit the instant represented in the browser.
      const deadline = formData.get("responseDeadline");
      if (typeof deadline === "string" && deadline) {
        const parsed = new Date(deadline);
        if (!Number.isNaN(parsed.getTime())) {
          formData.set("responseDeadline", parsed.toISOString());
        }
      }
      return action(previousState, formData);
    },
    initialState,
  );

  const updateField = (field: keyof EditableShiftFields, value: string) => {
    setFields((currentFields) => ({
      ...currentFields,
      [field]: value,
    }));
  };

  return (
    <form action={formAction} className="space-y-7">
      <input
        type="hidden"
        name="requirements"
        value={JSON.stringify(
          requirements.map((requirement) => ({
            ...requirement,
            count: Number(requirement.count),
          })),
        )}
      />

      {state.error && (
        <div
          role="alert"
          aria-live="polite"
          className="alert-error"
        >
          {state.error}
        </div>
      )}

      <fieldset disabled={isPending} className="form-section">
        <legend className="section-title">Event details</legend>
        <p className="mt-1 text-sm text-slate-600">
          The information staff will use to recognize and prepare for this shift.
        </p>
        <div className="mt-5">
          <label
            htmlFor="eventName"
            className="form-label"
          >
            Event name
          </label>
          <input
            type="text"
            id="eventName"
            name="eventName"
            value={fields.eventName}
            onChange={(event) => updateField("eventName", event.target.value)}
            required
            className="form-input"
          />
        </div>

      </fieldset>

      <fieldset disabled={isPending} className="form-section">
        <legend className="section-title">Timing</legend>
        <p className="mt-1 text-sm text-slate-600">
          Set the date and the start and end times for this shift.
        </p>
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="date" className="form-label">Date</label>
            <input
              type="date"
              id="date"
              name="date"
              value={fields.date}
              onChange={(event) => updateField("date", event.target.value)}
              required
              className="form-input"
            />
          </div>
          <div>
            <label htmlFor="startTime" className="form-label">Start time</label>
            <input
              type="time"
              id="startTime"
              name="startTime"
              step={initialValues ? "any" : undefined}
              value={fields.startTime}
              onChange={(event) => updateField("startTime", event.target.value)}
              required
              className="form-input"
            />
          </div>
          <div>
            <label htmlFor="endTime" className="form-label">End time</label>
            <input
              type="time"
              id="endTime"
              name="endTime"
              step={initialValues ? "any" : undefined}
              value={fields.endTime}
              onChange={(event) => updateField("endTime", event.target.value)}
              required
              className="form-input"
            />
          </div>
        </div>
      </fieldset>

      <fieldset disabled={isPending} className="form-section">
        <legend className="section-title">Location &amp; notes</legend>
        <p className="mt-1 text-sm text-slate-600">
          Add practical details that will help staff arrive prepared.
        </p>
        <div className="mt-5">
          <label htmlFor="location" className="form-label">Location</label>
          <input
            type="text"
            id="location"
            name="location"
            value={fields.location}
            onChange={(event) => updateField("location", event.target.value)}
            className="form-input"
          />
        </div>
        <div className="mt-4">
          <label htmlFor="notes" className="form-label">Notes</label>
          <textarea
            id="notes"
            name="notes"
            value={fields.notes}
            onChange={(event) => updateField("notes", event.target.value)}
            rows={3}
            className="form-input"
          />
        </div>
      </fieldset>

      <fieldset disabled={isPending} className="form-section">
        <legend className="section-title">Response deadline</legend>
        <p className="mt-1 text-sm text-slate-600">
          Choose when staff can no longer update availability.
        </p>
        <div className="mt-5 max-w-md">
          <label htmlFor="responseDeadline" className="form-label">
            Deadline
          </label>
          <input
            type="datetime-local"
            id="responseDeadline"
            name="responseDeadline"
            step={initialValues ? "any" : undefined}
            value={fields.responseDeadline}
            onChange={(event) =>
              updateField("responseDeadline", event.target.value)
            }
            required
            className="form-input"
          />
        </div>
      </fieldset>

      <StaffRequirementsFieldset
        requirements={requirements}
        onChange={setRequirements}
        disabled={isPending}
        preserveFirstRequirement={!isEditing}
      />

      <div className="sticky bottom-3 flex flex-col-reverse gap-3 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg shadow-slate-900/5 backdrop-blur sm:flex-row sm:items-center sm:justify-end">
        <Link
          href={cancelHref}
          className="btn btn-ghost w-full sm:w-auto"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="btn btn-primary w-full sm:w-auto"
        >
          {isPending ? (isEditing ? "Saving..." : "Creating...") : (isEditing ? "Save Changes" : "Create Shift")}
        </button>
      </div>
    </form>
  );
}
