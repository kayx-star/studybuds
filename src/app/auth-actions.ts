"use server";

import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { authSessions, passwordResets, students, users } from "@/db/schema";
import type { FormState } from "@/app/group-actions";
import { localePath } from "@/i18n/config";
import { getActionI18n } from "@/i18n/server";
import type { Dict } from "@/i18n/zh";
import { mailConfigured, sendMail } from "@/lib/mail";
import {
  clearLoginFailures,
  endSession,
  hashPassword,
  loginLocked,
  recordLoginFailure,
  startSession,
  verifyPassword,
} from "@/lib/session";

const email = (e: Dict["auth"]["errors"]) => z.string().trim().toLowerCase().email(e.invalidEmail);

/** 只允许站内跳转，防止被利用跳到外部网站 */
function safeNext(value: FormDataEntryValue | null, fallback: string) {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}

const signupSchema = (e: Dict["auth"]["errors"]) =>
  z
    .object({
      email: email(e),
      password: z.string().min(8, e.passwordTooShort).max(100),
      confirm: z.string(),
    })
    .refine((d) => d.password === d.confirm, { message: e.passwordMismatch });

export async function signup(_prev: FormState, formData: FormData): Promise<FormState> {
  const { locale, t } = await getActionI18n();
  const parsed = signupSchema(t.auth.errors).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { email, password } = parsed.data;

  const db = await getDb();
  const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (exists) return { error: t.auth.errors.emailTaken };

  const id = crypto.randomUUID();
  await db.insert(users).values({ id, email, passwordHash: await hashPassword(password), createdAt: new Date() });
  await startSession(id);
  redirect(localePath(locale, "/join"));
}

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const { locale, t } = await getActionI18n();
  const parsedEmail = email(t.auth.errors).safeParse(formData.get("email"));
  const password = String(formData.get("password") ?? "");
  if (!parsedEmail.success) return { error: parsedEmail.error.issues[0].message };
  const address = parsedEmail.data;
  if (loginLocked(address)) return { error: t.auth.errors.locked };

  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.email, address));
  // 账号不存在也走一遍校验，避免通过响应时间判断邮箱是否注册
  const ok = user ? await verifyPassword(password, user.passwordHash) : (await hashPassword(password), false);
  if (!user || !ok) {
    recordLoginFailure(address);
    return { error: t.auth.errors.wrongCredentials };
  }
  clearLoginFailures(address);
  await startSession(user.id);

  const [profile] = await db.select({ id: students.id }).from(students).where(eq(students.id, user.id));
  redirect(localePath(locale, profile ? safeNext(formData.get("next"), "/me") : "/join"));
}

export async function logout() {
  const { locale } = await getActionI18n();
  await endSession();
  redirect(localePath(locale, "/"));
}

// ---------- 找回密码 ----------

const RESET_TTL_MS = 30 * 60_000;
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

// 同一邮箱 15 分钟内最多申请 3 次（单机内存版，上线多实例时需换成数据库/Redis）
const resetRequests = new Map<string, number[]>();
function tooManyResets(email: string) {
  const now = Date.now();
  const recent = (resetRequests.get(email) ?? []).filter((t) => now - t < 15 * 60_000);
  resetRequests.set(email, [...recent, now]);
  return recent.length >= 3;
}

/** 网站地址：优先用 APP_URL，否则按当前请求推断 */
async function siteOrigin() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const { locale, t } = await getActionI18n();
  const parsed = email(t.auth.errors).safeParse(formData.get("email"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const address = parsed.data;
  if (tooManyResets(address)) return { error: t.auth.errors.tooManyResets };

  // 无论邮箱是否注册，都返回同样的提示，防止被用来试探哪些邮箱注册过
  const done: FormState = { ok: t.auth.linkSent };
  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.email, address));
  if (!user) return done;

  const token = randomBytes(32).toString("base64url");
  await db.insert(passwordResets).values({
    tokenHash: sha256(token),
    userId: user.id,
    expiresAt: new Date(Date.now() + RESET_TTL_MS),
  });
  const link = `${await siteOrigin()}${localePath(locale, `/reset?token=${token}`)}`;

  if (mailConfigured) {
    const sent = await sendMail(address, t.auth.emailSubject, t.auth.emailBody(link));
    return sent ? done : { error: t.auth.errors.mailFailed };
  }
  // 没配置邮件服务：开发时直接把链接给出来方便测试；正式环境绝不显示
  if (process.env.NODE_ENV === "development") {
    console.log(`[mail] 未配置 SMTP，重设链接：${link}`);
    return { ...done, ok: t.auth.devLink, link };
  }
  return { error: t.auth.errors.mailFailed };
}

const resetSchema = (e: Dict["auth"]["errors"]) =>
  z
    .object({
      token: z.string().min(10, e.invalidToken),
      password: z.string().min(8, e.passwordTooShort).max(100),
      confirm: z.string(),
    })
    .refine((d) => d.password === d.confirm, { message: e.passwordMismatch });

export async function resetPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const { locale, t } = await getActionI18n();
  const parsed = resetSchema(t.auth.errors).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { token, password } = parsed.data;

  const db = await getDb();
  const now = new Date();
  // 原子地把令牌标记为已使用，确保一个链接只能用一次
  const [reset] = await db
    .update(passwordResets)
    .set({ usedAt: now })
    .where(and(eq(passwordResets.tokenHash, sha256(token)), isNull(passwordResets.usedAt), gt(passwordResets.expiresAt, now)))
    .returning();
  if (!reset) return { error: t.auth.errors.invalidToken };

  await db.update(users).set({ passwordHash: await hashPassword(password) }).where(eq(users.id, reset.userId));
  // 改密码后让所有设备上的登录失效
  await db.delete(authSessions).where(eq(authSessions.userId, reset.userId));
  const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, reset.userId));
  if (user) clearLoginFailures(user.email);
  redirect(localePath(locale, "/login?reset=1"));
}
