import Link from "next/link";
import { Suspense } from "react";
import { resetPassword } from "@/app/auth-actions";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { localePath } from "@/i18n/config";
import { getI18n } from "@/i18n/server";

async function ResetForm({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const [{ token }, { locale, t }] = await Promise.all([searchParams, getI18n()]);
  const a = t.auth;
  if (!token) {
    return (
      <p className="card text-sm">
        {a.errors.invalidToken}{" "}
        <Link href={localePath(locale, "/forgot")} className="text-accent underline">{a.forgotTitle}</Link>
      </p>
    );
  }
  return (
    <ActionForm action={resetPassword} className="card space-y-4">
      <input type="hidden" name="token" value={token} />
      <label className="block text-sm">
        {a.newPassword}
        <span className="text-muted">{a.passwordHint}</span>
        <input name="password" type="password" required minLength={8} autoComplete="new-password" className="input mt-1" />
      </label>
      <label className="block text-sm">
        {a.confirm}
        <input name="confirm" type="password" required autoComplete="new-password" className="input mt-1" />
      </label>
      <SubmitButton pending={a.resetting}>{a.resetButton}</SubmitButton>
    </ActionForm>
  );
}

export default async function ResetPage({ searchParams }: PageProps<"/[lang]/reset">) {
  const { t } = await getI18n();
  return (
    <div className="mx-auto max-w-sm space-y-6 py-6">
      <h1 className="text-center text-2xl font-semibold">{t.auth.resetTitle}</h1>
      <Suspense>
        <ResetForm searchParams={searchParams as Promise<{ token?: string }>} />
      </Suspense>
    </div>
  );
}
