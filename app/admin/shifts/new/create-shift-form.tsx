"use client";

import { createShift } from "../actions";
import { ShiftForm, type ShiftFormValues } from "../shift-form";

export function CreateShiftForm({
  initialDate,
  initialValues,
  cancelHref,
}: {
  initialDate?: string;
  initialValues?: ShiftFormValues;
  cancelHref?: string;
}) {
  return (
    <ShiftForm
      action={createShift}
      mode="create"
      initialDate={initialDate}
      initialValues={initialValues}
      cancelHref={cancelHref}
    />
  );
}
