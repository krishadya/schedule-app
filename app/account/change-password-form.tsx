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
      className="surface-card p-5 sm:p-6"
    >
      <h2 className="section-title">
        Change Password
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Choose a password with at least 8 characters.
      </p>

      <fieldset disabled={isPending} className="mt-5 space-y-4">
        <div>
          <label
            htmlFor="newPassword"
            className="form-label"
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
            className="form-input"
          />
        </div>

        <div>
          <label
            htmlFor="confirmNewPassword"
            className="form-label"
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
            className="form-input"
          />
          <p className="form-help">
            Use at least 8 characters.
          </p>
        </div>

        <div aria-live="polite">
          {state.status === "error" ? (
            <p role="alert" className="alert-error">
              {state.message}
            </p>
          ) : null}
          {state.status === "success" ? (
            <p className="alert-success">{state.message}</p>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="btn btn-primary w-full sm:w-auto"
        >
          {isPending ? "Changing..." : "Change Password"}
        </button>
      </fieldset>
    </form>
  );
}
