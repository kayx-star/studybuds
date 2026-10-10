"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { students, users } from "@/db/schema";
import type { FormState } from "@/app/group-actions";
import { localePath } from "@/i18n/config";
import { getActionI18n } from "@/i18n/server";
import type { Dict } from "@/i18n/zh";
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
