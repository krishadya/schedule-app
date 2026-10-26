export type ShiftRequirement = {
  role: string;
  staffNeeded: number;
};

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;

function getTextValue(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

export function isValidDate(value: string) {
  const match = DATE_PATTERN.exec(value);

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsedDate = new Date(Date.UTC(year, month - 1, day));

  return (
    parsedDate.getUTCFullYear() === year &&
    parsedDate.getUTCMonth() === month - 1 &&
    parsedDate.getUTCDate() === day
  );
}

export function getTimeInSeconds(value: string) {
  const match = TIME_PATTERN.exec(value);

  if (!match) {
    return null;
  }

  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3] ?? 0);
}

export function parseRequirements(rawRequirements: string):
  | { success: true; requirements: ShiftRequirement[] }
  | { success: false; error: string } {
  let submittedRequirements: unknown;

  try {
    submittedRequirements = JSON.parse(rawRequirements);
  } catch {
    return {
      success: false,
      error: "Staff requirements could not be read. Please review them and try again.",
    };
  }

  if (
    !Array.isArray(submittedRequirements) ||
    submittedRequirements.length === 0
  ) {
    return { success: false, error: "Add at least one staff requirement." };
  }

  const roleNames = new Set<string>();
  const requirements: ShiftRequirement[] = [];

  for (const submittedRequirement of submittedRequirements) {
    if (
      typeof submittedRequirement !== "object" ||
      submittedRequirement === null ||
      Array.isArray(submittedRequirement)
    ) {
      return {
        success: false,
        error: "Each staff requirement must include a role and staff count.",
      };
    }

    const requirementRecord = submittedRequirement as Record<string, unknown>;
    const role =
      typeof requirementRecord.role === "string"
        ? requirementRecord.role.trim()
        : "";
    const staffNeeded = requirementRecord.count;

    if (!role) {
      return {
        success: false,
        error: "Each staff requirement must include a role.",
      };
    }

    if (
      typeof staffNeeded !== "number" ||
      !Number.isInteger(staffNeeded) ||
      staffNeeded < 1
    ) {
      return {
        success: false,
        error: "Staff needed must be a whole number of at least 1.",
      };
    }

    const normalizedRole = role.toLowerCase();

    if (roleNames.has(normalizedRole)) {
      return {
        success: false,
        error: "Staff requirement roles must be unique.",
      };
    }

    roleNames.add(normalizedRole);
    requirements.push({ role, staffNeeded });
  }

  return { success: true, requirements };
}

export function parseShiftForm(formData: FormData) {
  const eventName = getTextValue(formData, "eventName");
  const date = getTextValue(formData, "date");
  const startTime = getTextValue(formData, "startTime");
  const endTime = getTextValue(formData, "endTime");
  const location = getTextValue(formData, "location");
  const responseDeadline = getTextValue(formData, "responseDeadline");
  const notes = getTextValue(formData, "notes");
  const rawRequirements = getTextValue(formData, "requirements");

  if (!eventName || !date || !startTime || !endTime || !responseDeadline) {
    return { success: false as const, error: "Complete all required shift fields." };
  }

  if (!isValidDate(date)) {
    return { success: false as const, error: "Enter a valid shift date." };
  }

  const startTimeInSeconds = getTimeInSeconds(startTime);
  const endTimeInSeconds = getTimeInSeconds(endTime);

  if (startTimeInSeconds === null || endTimeInSeconds === null) {
    return { success: false as const, error: "Enter valid start and end times." };
  }

  if (endTimeInSeconds <= startTimeInSeconds) {
    return { success: false as const, error: "End time must be later than start time." };
  }

  const parsedDeadline = new Date(responseDeadline);

  if (Number.isNaN(parsedDeadline.getTime())) {
    return { success: false as const, error: "Enter a valid response deadline." };
  }

  const parsedRequirements = parseRequirements(rawRequirements);

  if (!parsedRequirements.success) {
    return { success: false as const, error: parsedRequirements.error };
  }


  return {
    success: true as const,
    data: { eventName, date, startTime, endTime, location, notes, parsedDeadline, parsedRequirements },
  };
}
