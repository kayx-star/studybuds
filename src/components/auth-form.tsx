import Link from "next/link";
import { login, signup } from "@/app/auth-actions";
import { localePath } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { ActionForm } from "./action-form";
import { SubmitButton } from "./submit-button";

export async function AuthForm({ mode, next }: { mode: "login" | "signup"; next?: string }) {
  const { locale, t } = await getI18n();
  const a = t.auth;
  const isLogin = mode === "login";
  const query = next ? `?next=${encodeURIComponent(next)}` : "";
  return (
    <div className="mx-auto max-w-sm space-y-6 py-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">{isLogin ? a.loginTitle : a.signupTitle}</h1>
        <p className="mt-1 text-sm text-muted">{isLogin ? a.loginSubtitle : a.signupSubtitle}</p>
      </div>
      <ActionForm action={isLogin ? login : signup} className="card space-y-4">
        {next && <input type="hidden" name="next" value={next} />}
        <label className="block text-sm">
          {a.email}
          <input name="email" type="email" required autoComplete="email" className="input mt-1" />
        </label>
        <label className="block text-sm">
          {a.password}
          {!isLogin && <span className="text-muted">{a.passwordHint}</span>}
          <input
            name="password"
            type="password"
            required
            minLength={isLogin ? undefined : 8}
            autoComplete={isLogin ? "current-password" : "new-password"}
            className="input mt-1"
          />
        </label>
        {!isLogin && (
          <label className="block text-sm">
            {a.confirm}
            <input name="confirm" type="password" required autoComplete="new-password" className="input mt-1" />
          </label>
        )}
        <div className="pt-1">
          <SubmitButton pending={isLogin ? a.loggingIn : a.signingUp}>
            {isLogin ? a.loginButton : a.signupButton}
          </SubmitButton>
        </div>
      </ActionForm>
      <p className="text-center text-sm text-muted">
        {isLogin ? a.noAccount : a.hasAccount}
        <Link href={localePath(locale, isLogin ? "/signup" : "/login") + query} className="text-accent hover:underline">
          {isLogin ? a.toSignup : a.toLogin}
        </Link>
      </p>
    </div>
  );
}
