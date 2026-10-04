"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { ActionState } from "./actions";

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

export function ShiftForm({ action, initialValues, cancelHref = "/admin/shifts" }: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  initialValues?: ShiftFormValues;
  cancelHref?: string;
}) {
  const isEditing = !!initialValues;
  const [requirements, setRequirements] = useState<StaffRequirement[]>(
    () => initialValues?.requirements ?? [{ id: crypto.randomUUID(), role: "", count: 1 }],
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
      { id: crypto.randomUUID(), role: "", count: 1 },
    ]);
  };

  const removeRequirement = (id: string) => {
    setRequirements(requirements.filter((req) => req.id !== id));
  };

  const updateRequirement = (
    id: string,
    field: keyof Omit<StaffRequirement, "id">,
    value: string | number,
  ) => {
    setRequirements(
      requirements.map((req) =>
        req.id === id ? { ...req, [field]: value } : req,
      ),
    );
  };

  return (
    <form action={formAction} className="space-y-6">
      <input
        type="hidden"
        name="requirements"
        value={JSON.stringify(requirements)}
      />

      {state.error && (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-md bg-red-50 p-4 text-sm text-red-700"
        >
          {state.error}
        </div>
      )}

      <fieldset disabled={isPending} className="space-y-4">
        <div>
          <label
            htmlFor="eventName"
            className="block text-sm font-medium text-slate-700"
          >
            Event name
          </label>
          <input
            type="text"
            id="eventName"
            name="eventName"
            defaultValue={initialValues?.eventName}
            required
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="date"
              className="block text-sm font-medium text-slate-700"
            >
              Date
            </label>
            <input
              type="date"
              id="date"
              name="date"
              defaultValue={initialValues?.date}
              required
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
          </div>

          <div>
            <label
              htmlFor="responseDeadline"
              className="block text-sm font-medium text-slate-700"
            >
              Response deadline
            </label>
            <input
              type="datetime-local"
              id="responseDeadline"
              name="responseDeadline"
              step={isEditing ? "any" : undefined}
              ref={(input) => {
                if (input && initialValues && !input.value) {
                  const deadline = new Date(initialValues.responseDeadline);
                  const local = new Date(deadline.getTime() - deadline.getTimezoneOffset() * 60_000);
                  input.value = local.toISOString().slice(0, -1);
                }
              }}
              required
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="startTime"
              className="block text-sm font-medium text-slate-700"
            >
              Start time
            </label>
            <input
              type="time"
              id="startTime"
              name="startTime"
              step={isEditing ? "any" : undefined}
              defaultValue={initialValues?.startTime}
              required
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
          </div>

          <div>
            <label
              htmlFor="endTime"
              className="block text-sm font-medium text-slate-700"
            >
              End time
            </label>
            <input
              type="time"
              id="endTime"
              name="endTime"
              step={isEditing ? "any" : undefined}
              defaultValue={initialValues?.endTime}
              required
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="location"
            className="block text-sm font-medium text-slate-700"
          >
            Location
          </label>
          <input
            type="text"
            id="location"
            name="location"
            defaultValue={initialValues?.location}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          />
        </div>

        <div>
          <label
            htmlFor="notes"
            className="block text-sm font-medium text-slate-700"
          >
            Notes
          </label>
          <textarea
            id="notes"
            name="notes"
            defaultValue={initialValues?.notes}
            rows={3}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          />
        </div>
      </fieldset>

      <fieldset disabled={isPending} className="border-t border-slate-200 pt-6">
        <h2 className="text-lg font-medium text-slate-900">
          Staff Requirements
        </h2>
        <div className="mt-4 space-y-4">
          {requirements.map((req, index) => (
            <div key={req.id} className="flex flex-wrap items-end gap-3">
              <div className="min-w-40 flex-1">
                <label className="block text-sm font-medium text-slate-700">
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
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                />
              </div>
              <div className="w-32">
                <label className="block text-sm font-medium text-slate-700">
                  Number needed
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={req.count}
                  onChange={(e) =>
                    updateRequirement(
                      req.id,
                      "count",
                      parseInt(e.target.value) || 1,
                    )
                  }
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                />
              </div>
              {(isEditing ? requirements.length > 1 : index > 0) && (
                <button
                  type="button"
                  onClick={() => removeRequirement(req.id)}
                  className="mb-[2px] rounded-md px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
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
          className="mt-4 inline-flex items-center text-sm font-medium text-slate-900 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          + Add another role
        </button>
      </fieldset>

      <div className="flex items-center justify-end gap-4 border-t border-slate-200 pt-6">
        <Link
          href={cancelHref}
          className="rounded-md px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? (isEditing ? "Saving..." : "Creating...") : (isEditing ? "Save Changes" : "Create Shift")}
        </button>
      </div>
    </form>
  );
}
