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
