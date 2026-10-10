import Link from "next/link";
import { requestPasswordReset } from "@/app/auth-actions";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { localePath } from "@/i18n/config";
import { getI18n } from "@/i18n/server";

export default async function ForgotPage() {
  const { locale, t } = await getI18n();
  const a = t.auth;
  return (
    <div className="mx-auto max-w-sm space-y-6 py-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">{a.forgotTitle}</h1>
        <p className="mt-1 text-sm text-muted">{a.forgotSubtitle}</p>
      </div>
      <ActionForm action={requestPasswordReset} className="card space-y-4">
        <label className="block text-sm">
          {a.email}
          <input name="email" type="email" required autoComplete="email" className="input mt-1" />
        </label>
        <SubmitButton pending={a.sendingLink}>{a.sendLink}</SubmitButton>
      </ActionForm>
      <p className="text-center text-sm">
        <Link href={localePath(locale, "/login")} className="text-accent hover:underline">{a.backToLogin}</Link>
      </p>
    </div>
  );
}
