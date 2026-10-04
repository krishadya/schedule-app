"use client";

import { useActionState, useEffect, useRef } from "react";

import {
  changePassword,
  type ChangePasswordActionState,
} from "./actions";

const initialState: ChangePasswordActionState = {
  status: "idle",
  message: null,
};

export function ChangePasswordForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState(
    changePassword,
    initialState,
  );

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <h2 className="text-lg font-semibold text-slate-900">
        Change Password
      </h2>

      <fieldset disabled={isPending} className="mt-5 space-y-4">
        <div>
          <label
            htmlFor="newPassword"
            className="block text-sm font-medium text-slate-700"
          >
            New Password
          </label>
          <input
            id="newPassword"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 disabled:cursor-not-allowed disabled:bg-slate-100"
          />
        </div>

        <div>
          <label
            htmlFor="confirmNewPassword"
            className="block text-sm font-medium text-slate-700"
          >
            Confirm New Password
          </label>
          <input
            id="confirmNewPassword"
            name="confirmNewPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 disabled:cursor-not-allowed disabled:bg-slate-100"
          />
          <p className="mt-1 text-xs text-slate-500">
            Use at least 8 characters.
          </p>
        </div>

        <div aria-live="polite">
          {state.status === "error" ? (
            <p role="alert" className="text-sm text-red-700">
              {state.message}
            </p>
          ) : null}
          {state.status === "success" ? (
            <p className="text-sm text-emerald-700">{state.message}</p>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Changing..." : "Change Password"}
        </button>
      </fieldset>
    </form>
  );
}
