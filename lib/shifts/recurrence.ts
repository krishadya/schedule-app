import {
  getTimeInSeconds,
  isValidDate,
  parseRequirements,
  type ShiftRequirement,
} from "./validation";

export const MAX_RECURRING_OCCURRENCES = 120;

export const WEEKDAYS = [
  { value: "monday", label: "Monday" },
  { value: "tuesday", label: "Tuesday" },
  { value: "wednesday", label: "Wednesday" },
  { value: "thursday", label: "Thursday" },
  { value: "friday", label: "Friday" },
  { value: "saturday", label: "Saturday" },
  { value: "sunday", label: "Sunday" },
] as const;

export type Weekday = (typeof WEEKDAYS)[number]["value"];

export const DEFAULT_REPEAT_DAYS: Weekday[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
];

type EditableRequirement = {
  role: string;
  count: string;
};

export type RecurringShiftDraft = {
  eventName: string;
  startDate: string;
  endDate: string;
  selectedDays: Weekday[];
  startTime: string;
  endTime: string;
  location: string;
  notes: string;
  responseDeadline: string;
  requirements: EditableRequirement[];
};

export type ValidatedRecurringShift = Omit<
  RecurringShiftDraft,
  "requirements"
> & {
  requirements: ShiftRequirement[];
};

export type RecurringShiftPreview = ValidatedRecurringShift & {
  dates: string[];
};

export type RecurrenceGenerationResult =
  | { success: true; dates: string[] }
  | {
      success: false;
      reason: "invalid-range" | "limit-exceeded";
      error: string;
    };

const weekdayByUtcDay: Weekday[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function parseDateKey(value: string) {
  if (!isValidDate(value)) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);

  return { year, month, day };
}

function createUtcDate(date: { year: number; month: number; day: number }) {
  const result = new Date(0);
  result.setUTCFullYear(date.year, date.month - 1, date.day);
  result.setUTCHours(0, 0, 0, 0);

  return result;
}

function formatUtcDateKey(date: Date) {
  return [
    String(date.getUTCFullYear()).padStart(4, "0"),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export function toggleRepeatDay(
  selectedDays: Weekday[],
  day: Weekday,
): Weekday[] {
  if (selectedDays.includes(day)) {
    if (selectedDays.length === 1) {
      return selectedDays;
    }

    return selectedDays.filter((selectedDay) => selectedDay !== day);
  }

  const nextSelection = new Set([...selectedDays, day]);

  return WEEKDAYS.filter(({ value }) => nextSelection.has(value)).map(
    ({ value }) => value,
  );
}

export function generateRecurringDates(
  startDate: string,
  endDate: string,
  selectedDays: Weekday[],
  limit = MAX_RECURRING_OCCURRENCES,
): RecurrenceGenerationResult {
  const parsedStart = parseDateKey(startDate);
  const parsedEnd = parseDateKey(endDate);

  if (!parsedStart || !parsedEnd || endDate < startDate) {
    return {
      success: false,
      reason: "invalid-range",
      error: "Enter a valid date range before previewing shifts.",
    };
  }

  if (selectedDays.length === 0) {
    return { success: true, dates: [] };
  }

  const selectedDaySet = new Set(selectedDays);
  const currentDate = createUtcDate(parsedStart);
  const finalDate = createUtcDate(parsedEnd);
  const dates: string[] = [];

  while (currentDate.getTime() <= finalDate.getTime()) {
    if (selectedDaySet.has(weekdayByUtcDay[currentDate.getUTCDay()])) {
      if (dates.length === limit) {
        return {
          success: false,
          reason: "limit-exceeded",
          error: `This schedule contains more than ${limit} shifts. Shorten the date range or select fewer weekdays.`,
        };
      }

      dates.push(formatUtcDateKey(currentDate));
    }

    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
  }

  return { success: true, dates };
}

export function validateRecurringShiftDraft(
  draft: RecurringShiftDraft,
):
  | { success: true; data: ValidatedRecurringShift }
  | { success: false; error: string } {
  const eventName = draft.eventName.trim();
  const startDate = draft.startDate.trim();
  const endDate = draft.endDate.trim();
  const startTime = draft.startTime.trim();
  const endTime = draft.endTime.trim();
  const responseDeadline = draft.responseDeadline.trim();

  if (!eventName) {
    return { success: false, error: "Event name is required." };
  }

  if (!isValidDate(startDate)) {
    return { success: false, error: "Enter a valid start date." };
  }

  if (!isValidDate(endDate)) {
    return { success: false, error: "Enter a valid end date." };
  }

  if (endDate < startDate) {
    return {
      success: false,
      error: "End date cannot be before the start date.",
    };
  }

  const validWeekdays = new Set<Weekday>(
    WEEKDAYS.map(({ value }) => value),
  );

  if (
    draft.selectedDays.length === 0 ||
    draft.selectedDays.some((day) => !validWeekdays.has(day))
  ) {
    return { success: false, error: "Select at least one valid weekday." };
  }

  const startTimeInSeconds = getTimeInSeconds(startTime);
  const endTimeInSeconds = getTimeInSeconds(endTime);

  if (startTimeInSeconds === null || endTimeInSeconds === null) {
    return { success: false, error: "Enter valid start and end times." };
  }

  if (endTimeInSeconds <= startTimeInSeconds) {
    return {
      success: false,
      error: "Shift end time must be later than the start time.",
    };
  }

  if (
    !responseDeadline ||
    Number.isNaN(new Date(responseDeadline).getTime())
  ) {
    return { success: false, error: "Enter a valid response deadline." };
  }

  const parsedRequirements = parseRequirements(
    JSON.stringify(
      draft.requirements.map((requirement) => ({
        role: requirement.role,
        count: Number(requirement.count),
      })),
    ),
  );

  if (!parsedRequirements.success) {
    return { success: false, error: parsedRequirements.error };
  }

  const selectedDaySet = new Set(draft.selectedDays);

  return {
    success: true,
    data: {
      eventName,
      startDate,
      endDate,
      selectedDays: WEEKDAYS.filter(({ value }) =>
        selectedDaySet.has(value),
      ).map(({ value }) => value),
      startTime,
      endTime,
      location: draft.location.trim(),
      notes: draft.notes.trim(),
      responseDeadline,
      requirements: parsedRequirements.requirements,
    },
  };
}
