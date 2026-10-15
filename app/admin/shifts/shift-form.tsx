"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { AppIcon } from "@/components/ui/app-icon";
import type { ActionState } from "./actions";

type StaffRequirement = {
  id: string;
  role: string;
  count: number;
};

type EditableStaffRequirement = Omit<StaffRequirement, "count"> & {
  count: string;
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

function formatDeadlineForInput(value: string) {
  const deadline = new Date(value);

  if (Number.isNaN(deadline.getTime())) {
    return value;
  }

  const localDeadline = new Date(
    deadline.getTime() - deadline.getTimezoneOffset() * 60_000,
  );

  return localDeadline.toISOString().slice(0, 19);
}

export function ShiftForm({ action, initialValues, initialDate, cancelHref = "/admin/shifts" }: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  initialValues?: ShiftFormValues;
  initialDate?: string;
  cancelHref?: string;
}) {
  const isEditing = !!initialValues;
  const [fields, setFields] = useState<EditableShiftFields>(() => ({
    eventName: initialValues?.eventName ?? "",
    date: initialValues?.date ?? initialDate ?? "",
    startTime: initialValues?.startTime ?? "",
    endTime: initialValues?.endTime ?? "",
    location: initialValues?.location ?? "",
    responseDeadline: initialValues
      ? formatDeadlineForInput(initialValues.responseDeadline)
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
      // Editing uses the browser's local time for display and an explicit instant on save.
      if (initialValues) {
        const deadline = formData.get("responseDeadline");
        if (typeof deadline === "string" && deadline) {
          const parsed = new Date(deadline);
          if (!Number.isNaN(parsed.getTime())) {
            formData.set("responseDeadline", parsed.toISOString());
          }
        }
      }
      return action(previousState, formData);
    },
    initialState,
  );

  const addRequirement = () => {
    setRequirements([
      ...requirements,
      { id: crypto.randomUUID(), role: "", count: "1" },
    ]);
  };

  const removeRequirement = (id: string) => {
    setRequirements(requirements.filter((req) => req.id !== id));
  };

  const updateRequirement = (
    id: string,
    field: keyof Omit<EditableStaffRequirement, "id">,
    value: string,
  ) => {
    setRequirements(
      requirements.map((req) =>
        req.id === id ? { ...req, [field]: value } : req,
      ),
    );
  };

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

      <fieldset disabled={isPending} className="space-y-4">
        <div>
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="date"
              className="form-label"
            >
              Date
            </label>
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
            <label
              htmlFor="responseDeadline"
              className="form-label"
            >
              Response deadline
            </label>
            <input
              type="datetime-local"
              id="responseDeadline"
              name="responseDeadline"
              step={isEditing ? "any" : undefined}
              value={fields.responseDeadline}
              onChange={(event) =>
                updateField("responseDeadline", event.target.value)
              }
              required
              className="form-input"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="startTime"
              className="form-label"
            >
              Start time
            </label>
            <input
              type="time"
              id="startTime"
              name="startTime"
              step={isEditing ? "any" : undefined}
              value={fields.startTime}
              onChange={(event) => updateField("startTime", event.target.value)}
              required
              className="form-input"
            />
          </div>

          <div>
            <label
              htmlFor="endTime"
              className="form-label"
            >
              End time
            </label>
            <input
              type="time"
              id="endTime"
              name="endTime"
              step={isEditing ? "any" : undefined}
              value={fields.endTime}
              onChange={(event) => updateField("endTime", event.target.value)}
              required
              className="form-input"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="location"
            className="form-label"
          >
            Location
          </label>
          <input
            type="text"
            id="location"
            name="location"
            value={fields.location}
            onChange={(event) => updateField("location", event.target.value)}
            className="form-input"
          />
        </div>

        <div>
          <label
            htmlFor="notes"
            className="form-label"
          >
            Notes
          </label>
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

      <fieldset disabled={isPending} className="border-t border-slate-200 pt-7">
        <h2 className="section-title">
          Staff Requirements
        </h2>
        <div className="mt-4 space-y-4">
          {requirements.map((req, index) => (
            <div
              key={req.id}
              className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4"
            >
              <div className="min-w-40 flex-1">
                <label className="form-label">
                  Role
                </label>
                <input
                  type="text"
                  required
                  placeholder="Technician"
                  value={req.role}
                  onChange={(e) =>
                    updateRequirement(req.id, "role", e.target.value)
                  }
                  className="form-input"
                />
              </div>
              <div className="w-32">
                <label className="form-label">
                  Number needed
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={req.count}
                  onChange={(e) =>
                    updateRequirement(req.id, "count", e.target.value)
                  }
                  className="form-input"
                />
              </div>
              {(isEditing ? requirements.length > 1 : index > 0) && (
                <button
                  type="button"
                  onClick={() => removeRequirement(req.id)}
                  className="btn btn-danger-outline mb-[2px]"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addRequirement}
          className="btn btn-secondary mt-4"
        >
          <AppIcon name="plus" className="h-4 w-4" />
          Add another role
        </button>
      </fieldset>

      <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-end">
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
