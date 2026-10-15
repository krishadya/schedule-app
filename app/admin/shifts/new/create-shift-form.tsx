"use client";

import { createShift } from "../actions";
import { ShiftForm } from "../shift-form";

export function CreateShiftForm({ initialDate }: { initialDate?: string }) {
  return <ShiftForm action={createShift} initialDate={initialDate} />;
}
