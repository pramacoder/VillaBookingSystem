"use client";

import { useActionState } from "react";
import { loginAction, type LoginFormState } from "@/app/admin/actions";
import type { AdminAuthDictionary } from "@/lib/i18n/admin-dictionaries";

interface LoginFormProps {
  dictionary: AdminAuthDictionary["login"];
}

const initialState: LoginFormState = {};

export function LoginForm({ dictionary }: LoginFormProps) {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);

  const errorMessage =
    state.error === "rate_limited"
      ? dictionary.rateLimited
      : state.error === "invalid_credentials"
        ? dictionary.invalidCredentials
        : null;

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {errorMessage ? (
        <div
          id="login-error-message"
          role="alert"
          aria-live="polite"
          className="flex items-start gap-2.5 rounded-[10px] border border-status-danger-fg/30 bg-status-danger-bg px-4 py-3 text-sm text-status-danger-fg"
        >
          <span aria-hidden="true" className="font-semibold">
            !
          </span>
          <span>{errorMessage}</span>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <label htmlFor="admin-email" className="block text-sm font-medium text-gray-800">
          {dictionary.emailLabel}
        </label>
        <input
          id="admin-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder={dictionary.emailPlaceholder}
          aria-invalid={Boolean(errorMessage)}
          aria-describedby={errorMessage ? "login-error-message" : undefined}
          className="h-11 w-full rounded-[6px] border border-gray-400/60 bg-white px-3.5 text-base text-gray-800 placeholder:text-gray-600/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="admin-password" className="block text-sm font-medium text-gray-800">
          {dictionary.passwordLabel}
        </label>
        <input
          id="admin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder={dictionary.passwordPlaceholder}
          aria-invalid={Boolean(errorMessage)}
          aria-describedby={errorMessage ? "login-error-message" : undefined}
          className="h-11 w-full rounded-[6px] border border-gray-400/60 bg-white px-3.5 text-base text-gray-800 placeholder:text-gray-600/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex h-11 w-full items-center justify-center rounded-[10px] bg-blue-600 px-5 text-sm font-medium text-white transition-colors hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? dictionary.submittingButton : dictionary.submitButton}
      </button>
    </form>
  );
}
