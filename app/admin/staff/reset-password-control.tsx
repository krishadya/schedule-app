"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import {
  resetStaffPassword,
  type ResetStaffPasswordActionState,
} from "./actions";

const initialState: ResetStaffPasswordActionState = {
  status: "idle",
  message: null,
};

export function ResetPasswordControl({
  staffId,
  fullName,
}: {
  staffId: string;
  fullName: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState(
    resetStaffPassword.bind(null, staffId),
    initialState,
  );

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <div className="w-full sm:w-auto">
      {isOpen ? (
        <form
          ref={formRef}
          action={formAction}
          className="mt-3 space-y-3 border-t border-slate-200 pt-4 sm:mt-0 sm:w-72 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0"
        >
          <p className="text-sm font-semibold text-slate-900">
            Reset Password
          </p>

          <fieldset disabled={isPending} className="space-y-3">
            <div>
              <label
                htmlFor={`new-password-${staffId}`}
                className="block text-xs font-medium text-slate-700"
              >
                New Temporary Password
              </label>
              <input
                id={`new-password-${staffId}`}
                name="newPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                aria-label={`New temporary password for ${fullName}`}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
            </div>

            <div>
              <label
                htmlFor={`confirm-password-${staffId}`}
                className="block text-xs font-medium text-slate-700"
              >
                Confirm Temporary Password
              </label>
              <input
                id={`confirm-password-${staffId}`}
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                aria-label={`Confirm temporary password for ${fullName}`}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
            </div>

            {state.status === "error" ? (
              <p role="alert" className="text-sm text-red-700">
                {state.message}
              </p>
            ) : null}
            {state.status === "success" ? (
              <p className="text-sm text-emerald-700" aria-live="polite">
                {state.message}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={isPending}
                className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPending ? "Resetting..." : "Reset Password"}
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  formRef.current?.reset();
                  setIsOpen(false);
                }}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {state.status === "success" ? "Close" : "Cancel"}
              </button>
            </div>
          </fieldset>
        </form>
      ) : (
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
          >
            Reset Password
          </button>
          {state.status === "success" ? (
            <p className="text-sm text-emerald-700" aria-live="polite">
              {state.message}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
