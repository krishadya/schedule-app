"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { UserAvatar } from "@/components/ui/user-avatar";
import {
  updateProfile,
  type UpdateProfileActionState,
} from "./actions";

const initialState: UpdateProfileActionState = {
  status: "idle",
  message: null,
};

export function ProfileForm({
  fullName,
  username,
  avatarUrl,
}: {
  fullName: string;
  username: string;
  avatarUrl: string | null;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [state, formAction, isPending] = useActionState(
    async (previousState: UpdateProfileActionState, formData: FormData) => {
      const result = await updateProfile(previousState, formData);

      if (result.status === "success") {
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        setPreviewUrl(null);
        setRemoveAvatar(false);
      }

      return result;
    },
    initialState,
  );

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  return (
    <form action={formAction} className="surface-card p-5 sm:p-6">
      <div className="border-b border-slate-100 pb-5">
        <h2 className="section-title">Profile details</h2>
        <p className="mt-1 text-sm text-slate-600">
          Update how your name and picture appear throughout Schedule App.
        </p>
      </div>

      <fieldset disabled={isPending} className="mt-5 space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <UserAvatar
            name={fullName}
            src={removeAvatar ? null : (previewUrl ?? avatarUrl)}
            size="lg"
          />
          <div className="min-w-0 flex-1">
            <label htmlFor="avatar" className="form-label">
              Profile picture
            </label>
            <input
              ref={fileInputRef}
              id="avatar"
              name="avatar"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="mt-2 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              onChange={(event) => {
                const file = event.target.files?.[0];
                setPreviewUrl(file ? URL.createObjectURL(file) : null);
                if (file) setRemoveAvatar(false);
              }}
            />
            <p className="form-help">JPG, PNG, or WebP. Maximum 768 KB.</p>
            {avatarUrl ? (
              <label className="mt-2 inline-flex min-h-9 cursor-pointer items-center gap-2 text-sm font-medium text-slate-600">
                <input
                  type="checkbox"
                  name="removeAvatar"
                  checked={removeAvatar}
                  onChange={(event) => {
                    setRemoveAvatar(event.target.checked);
                    if (event.target.checked) {
                      if (fileInputRef.current) fileInputRef.current.value = "";
                      setPreviewUrl(null);
                    }
                  }}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                Remove current picture
              </label>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="fullName" className="form-label">
              Full name
            </label>
            <input
              id="fullName"
              name="fullName"
              type="text"
              defaultValue={fullName}
              maxLength={100}
              autoComplete="name"
              required
              className="form-input"
            />
          </div>
          <div>
            <label htmlFor="profileUsername" className="form-label">
              Username
            </label>
            <input
              id="profileUsername"
              name="username"
              type="text"
              defaultValue={username}
              maxLength={50}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              pattern="[A-Za-z0-9._\-]+"
              required
              className="form-input lowercase"
            />
            <p className="form-help">
              Changing this also changes the username used for your next sign-in.
            </p>
          </div>
        </div>

        <div aria-live="polite">
          {state.status === "error" ? (
            <p role="alert" className="alert-error">{state.message}</p>
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
          {isPending ? "Saving..." : "Save Profile"}
        </button>
      </fieldset>
    </form>
  );
}
