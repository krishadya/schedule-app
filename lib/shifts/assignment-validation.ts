export function validateAssignedRoles(
  requirements: Array<{ role: string; staffNeeded: number }>,
  assignments: Array<{ assigned_role: string }>,
): string | null {
  const capacity = new Map(requirements.map((row) => [row.role, row.staffNeeded]));
  const counts = new Map<string, number>();

  for (const assignment of assignments) {
    const role = assignment.assigned_role;
    // Assignments store exact role names; even changing capitalization needs removal first.
    if (!capacity.has(role)) {
      return `The role "${role}" has assigned staff. Remove those assignments before renaming or removing the role.`;
    }
    counts.set(role, (counts.get(role) ?? 0) + 1);
  }

  for (const [role, count] of counts) {
    if (count > capacity.get(role)!) {
      return `The role "${role}" already has ${count} assigned staff. Increase the required count or remove assignments first.`;
    }
  }

  return null;
}
