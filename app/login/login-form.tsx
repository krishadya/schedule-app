"use client";

import { useActionState } from "react";

import { AppLogo } from "@/components/ui/app-logo";
import { login, type LoginState } from "./actions";

const initialState: LoginState = {
  error: null,
};

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(login, initialState);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100/70 px-4 py-12 sm:px-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)] sm:p-9">
        <div className="text-center">
          <div className="flex justify-center">
            <AppLogo showName={false} />
          </div>
          <h1 className="mt-5 text-2xl font-bold tracking-[-0.03em] text-slate-950 sm:text-3xl">
            Schedule App
          </h1>
          <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-slate-600">
            Sign in to view schedules, share availability, and manage events.
          </p>
        </div>

        <form action={formAction} className="mt-7 space-y-5">
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
              placeholder="your_username"
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
              placeholder="********"
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
          Internal access for authorized event staff.
        </p>
      </div>
    </main>
  );
}
