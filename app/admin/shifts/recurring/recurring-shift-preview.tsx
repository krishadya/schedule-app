import { AppIcon } from "@/components/ui/app-icon";
import {
  WEEKDAYS,
  type RecurringShiftPreview as RecurringShiftPreviewData,
} from "@/lib/shifts/recurrence";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

const deadlineFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDate(date: string) {
  return dateFormatter.format(new Date(`${date}T00:00:00Z`));
}

function formatTime(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const twelveHour = hours % 12 || 12;

  return `${twelveHour}:${String(minutes).padStart(2, "0")} ${period}`;
}

function formatDeadline(deadline: string) {
  return deadlineFormatter.format(new Date(deadline));
}

export function RecurringShiftPreview({
  preview,
}: {
  preview: RecurringShiftPreviewData;
}) {
  const weekdayLabels = new Map(
    WEEKDAYS.map(({ value, label }) => [value, label]),
  );
  const timeRange = `${formatTime(preview.startTime)} – ${formatTime(preview.endTime)}`;

  return (
    <section
      aria-labelledby="recurring-preview-heading"
      className="mt-8 space-y-6 border-t border-slate-200 pt-8"
    >
      <div className="surface-card overflow-hidden">
        <div className="border-b border-indigo-100 bg-indigo-50 px-5 py-5 sm:px-6">
          <p className="page-eyebrow">Preview</p>
          <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2
                id="recurring-preview-heading"
                className="text-2xl font-bold tracking-tight text-slate-950"
              >
                {preview.eventName}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Review every occurrence before bulk saving is enabled.
              </p>
            </div>
            <div className="rounded-lg border border-indigo-200 bg-white px-4 py-2 text-center shadow-sm">
              <span className="block text-2xl font-bold text-indigo-700">
                {preview.dates.length}
              </span>
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {preview.dates.length === 1 ? "Shift" : "Shifts"}
              </span>
            </div>
          </div>
        </div>

        <dl className="grid gap-px bg-slate-200 sm:grid-cols-2 lg:grid-cols-3">
          <div className="bg-white p-4 sm:p-5">
            <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Date Range
            </dt>
            <dd className="mt-1 text-sm font-semibold text-slate-900">
              {formatDate(preview.startDate)} – {formatDate(preview.endDate)}
            </dd>
          </div>
          <div className="bg-white p-4 sm:p-5">
            <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Repeats
            </dt>
            <dd className="mt-1 text-sm font-semibold text-slate-900">
              {preview.selectedDays
                .map((day) => weekdayLabels.get(day))
                .join(", ")}
            </dd>
          </div>
          <div className="bg-white p-4 sm:p-5">
            <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Shift Time
            </dt>
            <dd className="mt-1 text-sm font-semibold text-slate-900">
              {timeRange}
            </dd>
          </div>
          <div className="bg-white p-4 sm:p-5">
            <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Response Deadline
            </dt>
            <dd className="mt-1 text-sm font-semibold text-slate-900">
              {formatDeadline(preview.responseDeadline)}
            </dd>
          </div>
          <div className="bg-white p-4 sm:p-5 lg:col-span-2">
            <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Staff Requirements
            </dt>
            <dd className="mt-2 flex flex-wrap gap-2">
              {preview.requirements.map((requirement) => (
                <span
                  key={requirement.role}
                  className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700"
                >
                  {requirement.role} × {requirement.staffNeeded}
                </span>
              ))}
            </dd>
          </div>
        </dl>
      </div>

      <div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="section-title">Generated Occurrences</h3>
            <p className="mt-1 text-sm text-slate-600">
              Dates are shown in chronological order.
            </p>
          </div>
          <span className="status-badge border-indigo-200 bg-indigo-50 text-indigo-700">
            {preview.dates.length} total
          </span>
        </div>

        <ol className="mt-4 grid gap-3 md:grid-cols-2">
          {preview.dates.map((date, index) => (
            <li key={date} className="surface-card p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-sm font-bold text-indigo-700 ring-1 ring-indigo-100">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-950">
                    {formatDate(date)}
                  </p>
                  <p className="mt-1 break-words text-sm font-medium text-slate-700">
                    {preview.eventName}
                  </p>
                  <div className="mt-3 space-y-1.5 text-sm text-slate-600">
                    <p className="flex items-center gap-2">
                      <AppIcon name="clock" className="h-4 w-4 text-indigo-500" />
                      {timeRange}
                    </p>
                    {preview.location ? (
                      <p className="flex items-center gap-2">
                        <AppIcon
                          name="location"
                          className="h-4 w-4 text-indigo-500"
                        />
                        <span className="break-words">{preview.location}</span>
                      </p>
                    ) : null}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {preview.requirements.map((requirement) => (
                      <span
                        key={requirement.role}
                        className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600"
                      >
                        {requirement.role} × {requirement.staffNeeded}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-5 sm:flex sm:items-center sm:justify-between sm:gap-6">
        <div>
          <h3 className="font-semibold text-slate-950">Ready to create?</h3>
          <p className="mt-1 text-sm text-slate-600">
            Bulk saving will be enabled in the next milestone.
          </p>
        </div>
        <button
          type="button"
          disabled
          className="btn btn-primary mt-4 w-full sm:mt-0 sm:w-auto"
        >
          Create All Shifts
        </button>
      </div>
    </section>
  );
}
