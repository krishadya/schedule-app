"use client";

import { AppIcon } from "@/components/ui/app-icon";

export type EditableStaffRequirement = {
  id: string;
  role: string;
  count: string;
};

type StaffRequirementsFieldsetProps = {
  requirements: EditableStaffRequirement[];
  onChange: (requirements: EditableStaffRequirement[]) => void;
  disabled?: boolean;
  preserveFirstRequirement?: boolean;
};

export function StaffRequirementsFieldset({
  requirements,
  onChange,
  disabled = false,
  preserveFirstRequirement = false,
}: StaffRequirementsFieldsetProps) {
  const addRequirement = () => {
    onChange([
      ...requirements,
      { id: crypto.randomUUID(), role: "", count: "1" },
    ]);
  };

  const removeRequirement = (id: string) => {
    if (requirements.length <= 1) {
      return;
    }

    onChange(requirements.filter((requirement) => requirement.id !== id));
  };

  const updateRequirement = (
    id: string,
    field: "role" | "count",
    value: string,
  ) => {
    onChange(
      requirements.map((requirement) =>
        requirement.id === id
          ? { ...requirement, [field]: value }
          : requirement,
      ),
    );
  };

  return (
    <fieldset disabled={disabled} className="form-section">
      <legend className="section-title">Staffing Requirements</legend>
      <p className="mt-1 text-sm text-slate-600">
        Add every role needed and the number of people required.
      </p>

      <div className="mt-4 space-y-4">
        {requirements.map((requirement, index) => {
          const canRemove =
            requirements.length > 1 &&
            (!preserveFirstRequirement || index > 0);

          return (
            <div
              key={requirement.id}
              className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-[minmax(0,1fr)_9rem_auto] sm:items-end"
            >
              <div className="min-w-0">
                <label
                  htmlFor={`role-${requirement.id}`}
                  className="form-label"
                >
                  Role
                </label>
                <input
                  id={`role-${requirement.id}`}
                  type="text"
                  required
                  placeholder="Technician"
                  value={requirement.role}
                  onChange={(event) =>
                    updateRequirement(
                      requirement.id,
                      "role",
                      event.target.value,
                    )
                  }
                  className="form-input"
                />
              </div>

              <div>
                <label
                  htmlFor={`count-${requirement.id}`}
                  className="form-label"
                >
                  Number Needed
                </label>
                <input
                  id={`count-${requirement.id}`}
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  required
                  value={requirement.count}
                  onChange={(event) =>
                    updateRequirement(
                      requirement.id,
                      "count",
                      event.target.value,
                    )
                  }
                  className="form-input"
                />
              </div>

              {canRemove ? (
                <button
                  type="button"
                  onClick={() => removeRequirement(requirement.id)}
                  className="btn btn-danger-outline w-full sm:mb-[2px] sm:w-auto"
                  aria-label={`Remove role ${index + 1}`}
                >
                  Remove Role
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={addRequirement}
        className="btn btn-secondary mt-4"
      >
        <AppIcon name="plus" className="h-4 w-4" />
        Add Role
      </button>
    </fieldset>
  );
}
