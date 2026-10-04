"use client";

import { useActionState, useEffect, useRef } from "react";

import {
  createStaffAccount,
  type CreateStaffActionState,
} from "./actions";

const initialState: CreateStaffActionState = {
  status: "idle",
  message: null,
};

export function CreateStaffForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState(
    createStaffAccount,
    initialState,
  );

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
    }
  }, [state.message, state.status]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="surface-card p-5 sm:p-6"
    >
      <h2 className="section-title">
        Create Staff Account
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Create an internal username and temporary password for a staff member.
      </p>

      <fieldset disabled={isPending} className="mt-5 space-y-4">
        <div>
          <label
            htmlFor="fullName"
            className="form-label"
          >
            Full Name
          </label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            autoComplete="name"
            required
            className="form-input"
          />
        </div>

        <div>
          <label
            htmlFor="username"
            className="form-label"
          >
            Username
          </label>
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            required
            spellCheck={false}
            aria-describedby="username-help"
            className="form-input lowercase"
          />
          <p id="username-help" className="form-help">
            Letters, numbers, underscore, dot, and hyphen only.
          </p>
        </div>

        <div>
          <label
            htmlFor="password"
            className="form-label"
          >
            Temporary Password
          </label>
          <input
            id="password"
            name="password"
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
          className="btn btn-primary w-full"
        >
          {isPending ? "Creating..." : "Create Staff Account"}
        </button>
      </fieldset>
    </form>
  );
}
