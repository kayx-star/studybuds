import Link from "next/link";
import { login, signup } from "@/app/auth-actions";
import { ActionForm } from "./action-form";
import { SubmitButton } from "./submit-button";

export function AuthForm({ mode, next }: { mode: "login" | "signup"; next?: string }) {
  const isLogin = mode === "login";
  const query = next ? `?next=${encodeURIComponent(next)}` : "";
  return (
    <div className="mx-auto max-w-sm space-y-6 py-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">{isLogin ? "登录" : "注册账号"}</h1>
        <p className="mt-1 text-sm text-muted">
          {isLogin ? "登录后可以在任何设备上看到你的资料和小组" : "注册后填写学习资料，开始匹配学习搭子"}
        </p>
      </div>
      <ActionForm action={isLogin ? login : signup} className="card space-y-4">
        {next && <input type="hidden" name="next" value={next} />}
        <label className="block text-sm">
          邮箱
          <input name="email" type="email" required autoComplete="email" className="input mt-1" />
        </label>
        <label className="block text-sm">
          密码{!isLogin && <span className="text-muted">（至少 8 位）</span>}
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
            确认密码
            <input name="confirm" type="password" required autoComplete="new-password" className="input mt-1" />
          </label>
        )}
        <div className="pt-1">
          <SubmitButton pending={isLogin ? "登录中…" : "注册中…"}>{isLogin ? "登录" : "注册"}</SubmitButton>
        </div>
      </ActionForm>
      <p className="text-center text-sm text-muted">
        {isLogin ? "还没有账号？" : "已经有账号了？"}
        <Link href={(isLogin ? "/signup" : "/login") + query} className="text-accent hover:underline">
          {isLogin ? "注册" : "去登录"}
        </Link>
      </p>
    </div>
  );
}
