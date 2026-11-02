export type CalendarResponse = "yes" | "maybe" | "no";

export type CalendarStatus =
  | "assigned"
  | "available"
  | "maybe"
  | "unavailable"
  | "needs-response";

export type CalendarRequirement = {
  role: string;
  staffNeeded: number;
  assignedCount: number | null;
};

export type CalendarAvailability = {
  response: CalendarResponse;
  suggestedStartTime: string | null;
  suggestedEndTime: string | null;
  note: string | null;
};

export type CalendarCoverage = {
  status: "fully_staffed" | "partially_staffed" | "unstaffed" | "no_requirements";
  filled: number;
  required: number;
  open: number;
};

export type CalendarShift = {
  id: string;
  eventName: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string | null;
  notes: string | null;
  responseDeadline: string;
  requirements: CalendarRequirement[];
  availability: CalendarAvailability | null;
  assignedRole: string | null;
  status: CalendarStatus;
  // Staffing coverage, only loaded for admins.
  coverage: CalendarCoverage | null;
};
