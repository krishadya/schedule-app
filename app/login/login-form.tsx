"use client";

import { useActionState } from "react";

import { AppIcon } from "@/components/ui/app-icon";
import { login, type LoginState } from "./actions";

const initialState: LoginState = {
  error: null,
};

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(login, initialState);

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12 sm:px-6 lg:px-8">
      <div
        aria-hidden="true"
        className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-indigo-200/35 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-blue-200/30 blur-3xl"
      />

      <div className="surface-card relative w-full max-w-md overflow-hidden p-6 sm:p-8">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-blue-500 to-indigo-500" />
        <div className="text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200">
            <AppIcon name="calendar" className="h-6 w-6" />
          </span>
          <h1 className="mt-5 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            Schedule App
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Staff availability and event scheduling
          </p>
        </div>

        <form action={formAction} className="mt-8 space-y-5">
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
              required
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              pattern="[A-Za-z0-9._-]+"
              title="Use only letters, numbers, underscores, dots, and hyphens."
              placeholder="username"
              disabled={isPending}
              className="form-input"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="form-label"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              disabled={isPending}
              className="form-input"
            />
          </div>

          {state.error ? (
            <p
              id="login-error"
              role="alert"
              className="alert-error"
            >
              {state.error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isPending}
            className="btn btn-primary w-full"
          >
            {isPending ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="mt-7 border-t border-slate-100 pt-5 text-center text-xs leading-5 text-slate-500">
          Use your staff account to access the scheduling system.
        </p>
      </div>
    </main>
  );
}
