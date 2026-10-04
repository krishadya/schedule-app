"use client";

import { createShift } from "../actions";
import { ShiftForm } from "../shift-form";

export function CreateShiftForm() {
  return <ShiftForm action={createShift} />;
}
