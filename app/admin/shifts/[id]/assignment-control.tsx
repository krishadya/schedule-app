"use client";

import { useActionState } from "react";

import {
  assignStaff,
  removeAssignment,
  type AssignmentActionState,
} from "./actions";

export type AssignmentRoleOption = {
  role: string;
  staffNeeded: number;
  assignedCount: number;
};

type StaffAssignmentControlProps = {
  shiftId: string;
  userId: string;
  assignedRole: string | null;
  roles: AssignmentRoleOption[];
};

const initialState: AssignmentActionState = { error: null };

function AssignStaffForm({
  shiftId,
  userId,
  roles,
}: Omit<StaffAssignmentControlProps, "assignedRole">) {
  const [state, formAction, isPending] = useActionState(
    assignStaff,
    initialState,
  );
  const hasAvailableRole = roles.some(
    (role) => role.assignedCount < role.staffNeeded,
  );

  return (
    <form action={formAction} className="mt-4 border-t border-slate-100 pt-4">
      <input type="hidden" name="shiftId" value={shiftId} />
      <input type="hidden" name="userId" value={userId} />

      <p className="text-sm font-medium text-slate-700">Not assigned</p>
      <fieldset
        disabled={isPending || !hasAvailableRole}
        className="mt-2 flex flex-col gap-2 sm:flex-row"
      >
        <label htmlFor={`assignment-role-${userId}`} className="sr-only">
          Assignment role
        </label>
        <select
          id={`assignment-role-${userId}`}
          name="assignedRole"
          required
          defaultValue=""
          className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:bg-slate-100"
        >
          <option value="" disabled>
            {hasAvailableRole ? "Select a role" : "All roles are full"}
          </option>
          {roles.map((role) => {
            const isFull = role.assignedCount >= role.staffNeeded;

            return (
              <option key={role.role} value={role.role} disabled={isFull}>
                {role.role}
                {isFull ? " (full)" : ""}
              </option>
            );
          })}
        </select>
        <button
          type="submit"
          disabled={isPending || !hasAvailableRole}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Assigning..." : "Assign"}
        </button>
      </fieldset>

      {state.error ? (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

function RemoveAssignmentForm({
  shiftId,
  userId,
  assignedRole,
}: Omit<StaffAssignmentControlProps, "roles"> & { assignedRole: string }) {
  const [state, formAction, isPending] = useActionState(
    removeAssignment,
    initialState,
  );

  return (
    <form action={formAction} className="mt-4 border-t border-slate-100 pt-4">
      <input type="hidden" name="shiftId" value={shiftId} />
      <input type="hidden" name="userId" value={userId} />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold text-slate-800">
          Assigned: {assignedRole}
        </p>
        <button
          type="submit"
          disabled={isPending}
          className="self-start rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Removing..." : "Remove Assignment"}
        </button>
      </div>

      {state.error ? (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

export function StaffAssignmentControl({
  shiftId,
  userId,
  assignedRole,
  roles,
}: StaffAssignmentControlProps) {
  if (assignedRole) {
    return (
      <RemoveAssignmentForm
        shiftId={shiftId}
        userId={userId}
        assignedRole={assignedRole}
      />
    );
  }

  return <AssignStaffForm shiftId={shiftId} userId={userId} roles={roles} />;
}
