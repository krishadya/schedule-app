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
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <h2 className="text-lg font-semibold text-slate-900">
        Create Staff Account
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Create an internal username and temporary password for a staff member.
      </p>

      <fieldset disabled={isPending} className="mt-5 space-y-4">
        <div>
          <label
            htmlFor="fullName"
            className="block text-sm font-medium text-slate-700"
          >
            Full Name
          </label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            autoComplete="name"
            required
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
          />
        </div>

        <div>
          <label
            htmlFor="username"
            className="block text-sm font-medium text-slate-700"
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
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm lowercase text-slate-900"
          />
          <p id="username-help" className="mt-1 text-xs text-slate-500">
            Letters, numbers, underscore, dot, and hyphen only.
          </p>
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-slate-700"
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
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
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
          className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Creating..." : "Create Staff Account"}
        </button>
      </fieldset>
    </form>
  );
}
