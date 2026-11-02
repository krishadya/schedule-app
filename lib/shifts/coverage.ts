// Staffing coverage is based only on confirmed assignments. Availability
// responses ("yes", "maybe") are never counted here.

export type CoverageRequirement = {
  role: string;
  staff_needed: number;
};

export type CoverageAssignment = {
  assigned_role: string;
};

export type ShiftCoverageStatus =
  | "fully_staffed"
  | "partially_staffed"
  | "unstaffed"
  | "no_requirements";

export type RoleCoverage = {
  role: string;
  needed: number;
  filled: number;
  open: number;
};

export type ShiftCoverage = {
  status: ShiftCoverageStatus;
  required: number;
  filled: number;
  open: number;
  roles: RoleCoverage[];
};

export type CoverageSummary = {
  shiftCount: number;
  fullyStaffed: number;
  needsStaff: number;
  noRequirements: number;
  openSlots: number;
};

export type CoverageTone = "emerald" | "amber" | "slate";

function toSlotCount(value: number) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

export function calculateShiftCoverage(
  requirements: CoverageRequirement[] | null | undefined,
  assignments: CoverageAssignment[] | null | undefined,
): ShiftCoverage {
  // Roles match by exact name, the same rule the assignment action uses.
  const neededByRole = new Map<string, number>();

  for (const requirement of requirements ?? []) {
    neededByRole.set(
      requirement.role,
      (neededByRole.get(requirement.role) ?? 0) +
        toSlotCount(requirement.staff_needed),
    );
  }

  const assignedByRole = new Map<string, number>();

  for (const assignment of assignments ?? []) {
    assignedByRole.set(
      assignment.assigned_role,
      (assignedByRole.get(assignment.assigned_role) ?? 0) + 1,
    );
  }

  // Assignments in a role the shift doesn't require are ignored, and extra
  // assignments in one role never fill another role's vacancy.
  const roles: RoleCoverage[] = [...neededByRole].map(([role, needed]) => {
    const filled = Math.min(needed, assignedByRole.get(role) ?? 0);

    return { role, needed, filled, open: needed - filled };
  });

  const required = roles.reduce((total, role) => total + role.needed, 0);
  const filled = roles.reduce((total, role) => total + role.filled, 0);
  const open = required - filled;

  let status: ShiftCoverageStatus;

  if (required === 0) {
    status = "no_requirements";
  } else if (open === 0) {
    status = "fully_staffed";
  } else if (filled === 0) {
    status = "unstaffed";
  } else {
    status = "partially_staffed";
  }

  return { status, required, filled, open, roles };
}

export function summarizeCoverage(coverages: ShiftCoverage[]): CoverageSummary {
  const summary: CoverageSummary = {
    shiftCount: coverages.length,
    fullyStaffed: 0,
    needsStaff: 0,
    noRequirements: 0,
    openSlots: 0,
  };

  for (const coverage of coverages) {
    if (coverage.status === "no_requirements") {
      summary.noRequirements += 1;
    } else if (coverage.status === "fully_staffed") {
      summary.fullyStaffed += 1;
    } else {
      summary.needsStaff += 1;
    }

    summary.openSlots += coverage.open;
  }

  return summary;
}

export function getCoverageLabel(coverage: ShiftCoverage) {
  if (coverage.status === "no_requirements") {
    return "No staffing set";
  }

  if (coverage.status === "fully_staffed") {
    return `Fully staffed · ${coverage.filled} / ${coverage.required}`;
  }

  const openLabel = coverage.open === 1 ? "open slot" : "open slots";

  return `${coverage.filled} / ${coverage.required} staffed · ${coverage.open} ${openLabel}`;
}

export function getCoverageTone(coverage: ShiftCoverage): CoverageTone {
  if (coverage.status === "fully_staffed") {
    return "emerald";
  }

  if (coverage.status === "partially_staffed") {
    return "amber";
  }

  return "slate";
}
