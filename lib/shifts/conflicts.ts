// Detects overlapping confirmed assignments. Shifts never cross midnight
// (the shift form requires end time > start time), so only shifts on the
// same calendar date can overlap.

export type ShiftTimeRange = {
  date: string;
  start_time: string;
  end_time: string;
};

export type ConflictingShift = {
  shiftId: string;
  eventName: string;
  startTime: string;
  endTime: string;
  assignedRole: string;
};

export type SameDayShift = {
  id: string;
  event_name: string;
  date: string;
  start_time: string;
  end_time: string;
  assignments: Array<{ user_id: string; assigned_role: string }> | null;
};

export function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

// Back-to-back shifts (one ends exactly when the next starts) don't overlap.
export function shiftsOverlap(first: ShiftTimeRange, second: ShiftTimeRange) {
  if (first.date !== second.date) {
    return false;
  }

  return (
    timeToMinutes(first.start_time) < timeToMinutes(second.end_time) &&
    timeToMinutes(second.start_time) < timeToMinutes(first.end_time)
  );
}

// Returns, per staff member, the other shifts they're assigned to that
// overlap the target shift.
export function findAssignmentConflicts(
  target: ShiftTimeRange & { id: string },
  otherShifts: SameDayShift[],
): Map<string, ConflictingShift[]> {
  const conflictsByUser = new Map<string, ConflictingShift[]>();

  for (const other of otherShifts) {
    if (other.id === target.id || !shiftsOverlap(target, other)) {
      continue;
    }

    for (const assignment of other.assignments ?? []) {
      const conflicts = conflictsByUser.get(assignment.user_id) ?? [];
      conflicts.push({
        shiftId: other.id,
        eventName: other.event_name,
        startTime: other.start_time,
        endTime: other.end_time,
        assignedRole: assignment.assigned_role,
      });
      conflictsByUser.set(assignment.user_id, conflicts);
    }
  }

  for (const conflicts of conflictsByUser.values()) {
    conflicts.sort((first, second) =>
      first.startTime.localeCompare(second.startTime),
    );
  }

  return conflictsByUser;
}
