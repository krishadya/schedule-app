"use client";

import { useState } from "react";
import Link from "next/link";

type StaffRequirement = {
  id: string;
  role: string;
  count: number;
};

export function CreateShiftForm() {
  const [requirements, setRequirements] = useState<StaffRequirement[]>([
    { id: crypto.randomUUID(), role: "", count: 1 },
  ]);

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
    value: string | number
  ) => {
    setRequirements(
      requirements.map((req) =>
        req.id === id ? { ...req, [field]: value } : req
      )
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Do not save any data yet per Milestone 5A.
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
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
            rows={3}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          />
        </div>
      </div>

      <div className="border-t border-slate-200 pt-6">
        <h2 className="text-lg font-medium text-slate-900">
          Staff Requirements
        </h2>
        <div className="mt-4 space-y-4">
          {requirements.map((req, index) => (
            <div key={req.id} className="flex items-end gap-4">
              <div className="flex-1">
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
                      parseInt(e.target.value) || 1
                    )
                  }
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                />
              </div>
              {index > 0 && (
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
      </div>

      <div className="flex items-center justify-end gap-4 border-t border-slate-200 pt-6">
        <Link
          href="/admin"
          className="rounded-md px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
        >
          Cancel
        </Link>
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          Create Shift
        </button>
      </div>
    </form>
  );
}
