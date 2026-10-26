"use client";

import Link from "next/link";
import { useState } from "react";

import {
  StaffRequirementsFieldset,
  type EditableStaffRequirement,
} from "../staff-requirements-fieldset";
import {
  DEFAULT_REPEAT_DAYS,
  toggleRepeatDay,
  WEEKDAYS,
  type Weekday,
} from "./recurring-form-state";

type RecurringShiftFields = {
  eventName: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  location: string;
  notes: string;
  responseDeadline: string;
};

const initialFields: RecurringShiftFields = {
  eventName: "",
  startDate: "",
  endDate: "",
  startTime: "",
  endTime: "",
  location: "",
  notes: "",
  responseDeadline: "",
};

export function RecurringShiftForm() {
  const [fields, setFields] = useState(initialFields);
  const [selectedDays, setSelectedDays] = useState<Weekday[]>(
    DEFAULT_REPEAT_DAYS,
  );
  const [requirements, setRequirements] = useState<
    EditableStaffRequirement[]
  >([{ id: "initial-recurring-requirement", role: "", count: "1" }]);

  const updateField = (
    field: keyof RecurringShiftFields,
    value: string,
  ) => {
    setFields((currentFields) => ({
      ...currentFields,
      [field]: value,
    }));
  };

  const dateRangeError =
    fields.startDate &&
    fields.endDate &&
    fields.endDate < fields.startDate
      ? "End date cannot be before the start date."
      : null;
  const timeRangeError =
    fields.startTime &&
    fields.endTime &&
    fields.endTime <= fields.startTime
      ? "Shift end time must be later than the start time."
      : null;

  return (
    <form
      className="space-y-7"
      onSubmit={(event) => event.preventDefault()}
    >
      <fieldset className="form-section">
        <legend className="section-title">Event Details</legend>
        <p className="mt-1 text-sm text-slate-600">
          Give the repeating shift a clear name that staff will recognize.
        </p>
        <div className="mt-5">
          <label htmlFor="recurring-event-name" className="form-label">
            Event Name
          </label>
          <input
            id="recurring-event-name"
            name="eventName"
            type="text"
            required
            placeholder="Table Squad"
            value={fields.eventName}
            onChange={(event) =>
              updateField("eventName", event.target.value)
            }
            className="form-input"
          />
        </div>
      </fieldset>

      <fieldset className="form-section">
        <legend className="section-title">Date Range &amp; Repetition</legend>
        <p className="mt-1 text-sm text-slate-600">
          Choose the date range and every weekday this shift should repeat.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="recurring-start-date" className="form-label">
              Start Date
            </label>
            <input
              id="recurring-start-date"
              name="startDate"
              type="date"
              required
              value={fields.startDate}
              onChange={(event) =>
                updateField("startDate", event.target.value)
              }
              className="form-input"
            />
          </div>
          <div>
            <label htmlFor="recurring-end-date" className="form-label">
              End Date
            </label>
            <input
              id="recurring-end-date"
              name="endDate"
              type="date"
              required
              min={fields.startDate || undefined}
              value={fields.endDate}
              onChange={(event) =>
                updateField("endDate", event.target.value)
              }
              aria-invalid={dateRangeError ? true : undefined}
              aria-describedby={dateRangeError ? "date-range-error" : undefined}
              className="form-input"
            />
          </div>
        </div>

        {dateRangeError ? (
          <p id="date-range-error" role="alert" className="mt-3 text-sm font-medium text-rose-700">
            {dateRangeError}
          </p>
        ) : null}

        <div className="mt-6">
          <p id="repeat-on-label" className="form-label">
            Repeat On
          </p>
          <div
            role="group"
            aria-labelledby="repeat-on-label"
            className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7"
          >
            {WEEKDAYS.map((weekday) => {
              const isSelected = selectedDays.includes(weekday.value);

              return (
                <button
                  key={weekday.value}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() =>
                    setSelectedDays((currentDays) =>
                      toggleRepeatDay(currentDays, weekday.value),
                    )
                  }
                  className={`min-h-11 rounded-lg border px-3 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
                    isSelected
                      ? "border-indigo-600 bg-indigo-600 text-white shadow-sm"
                      : "border-slate-300 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                  }`}
                >
                  {weekday.label}
                </button>
              );
            })}
          </div>
          <p className="form-help">
            Monday through Friday are selected by default. At least one day
            must remain selected.
          </p>
        </div>
      </fieldset>

      <fieldset className="form-section">
        <legend className="section-title">Shift Timing</legend>
        <p className="mt-1 text-sm text-slate-600">
          Set the shared times and response deadline for the repeating schedule.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="recurring-start-time" className="form-label">
              Shift Start Time
            </label>
            <input
              id="recurring-start-time"
              name="startTime"
              type="time"
              required
              value={fields.startTime}
              onChange={(event) =>
                updateField("startTime", event.target.value)
              }
              className="form-input"
            />
          </div>
          <div>
            <label htmlFor="recurring-end-time" className="form-label">
              Shift End Time
            </label>
            <input
              id="recurring-end-time"
              name="endTime"
              type="time"
              required
              value={fields.endTime}
              onChange={(event) =>
                updateField("endTime", event.target.value)
              }
              aria-invalid={timeRangeError ? true : undefined}
              aria-describedby={timeRangeError ? "time-range-error" : undefined}
              className="form-input"
            />
          </div>
        </div>

        {timeRangeError ? (
          <p id="time-range-error" role="alert" className="mt-3 text-sm font-medium text-rose-700">
            {timeRangeError}
          </p>
        ) : null}

        <div className="mt-5 max-w-md">
          <label htmlFor="recurring-response-deadline" className="form-label">
            Response Deadline
          </label>
          <input
            id="recurring-response-deadline"
            name="responseDeadline"
            type="datetime-local"
            required
            value={fields.responseDeadline}
            onChange={(event) =>
              updateField("responseDeadline", event.target.value)
            }
            className="form-input"
          />
          <p className="form-help">
            This local date and time will be shared by every generated shift.
          </p>
        </div>
      </fieldset>

      <StaffRequirementsFieldset
        requirements={requirements}
        onChange={setRequirements}
      />

      <fieldset className="form-section">
        <legend className="section-title">Additional Details</legend>
        <p className="mt-1 text-sm text-slate-600">
          Add optional information that applies to every shift in the series.
        </p>

        <div className="mt-5">
          <label htmlFor="recurring-location" className="form-label">
            Location
          </label>
          <input
            id="recurring-location"
            name="location"
            type="text"
            value={fields.location}
            onChange={(event) =>
              updateField("location", event.target.value)
            }
            className="form-input"
          />
        </div>

        <div className="mt-4">
          <label htmlFor="recurring-notes" className="form-label">
            Notes
          </label>
          <textarea
            id="recurring-notes"
            name="notes"
            rows={4}
            value={fields.notes}
            onChange={(event) => updateField("notes", event.target.value)}
            className="form-input"
          />
        </div>
      </fieldset>

      <div className="sticky bottom-3 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg shadow-slate-900/5 backdrop-blur">
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/admin/shifts" className="btn btn-ghost w-full sm:w-auto">
            Cancel
          </Link>
          <button
            type="button"
            disabled
            aria-describedby="recurring-preview-note"
            className="btn btn-primary w-full sm:w-auto"
          >
            Preview Recurring Shifts
          </button>
        </div>
        <p
          id="recurring-preview-note"
          className="mt-2 text-center text-xs text-slate-500 sm:text-right"
        >
          Preview and saving are coming in the next milestone. Nothing will be
          saved from this form yet.
        </p>
      </div>
    </form>
  );
}
