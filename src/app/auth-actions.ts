"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { students, users } from "@/db/schema";
import type { FormState } from "@/app/group-actions";
import {
  clearLoginFailures,
  endSession,
  hashPassword,
  loginLocked,
  recordLoginFailure,
  startSession,
  verifyPassword,
} from "@/lib/session";

const Email = z.string().trim().toLowerCase().email("请输入有效的邮箱");

/** 只允许站内跳转，防止被利用跳到外部网站 */
function safeNext(value: FormDataEntryValue | null, fallback: string) {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}

const SignupSchema = z
  .object({
    email: Email,
    password: z.string().min(8, "密码至少 8 位").max(100),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: "两次输入的密码不一致" });

export async function signup(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = SignupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { email, password } = parsed.data;

  const db = await getDb();
  const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (exists) return { error: "这个邮箱已经注册过了，请直接登录" };

  const id = crypto.randomUUID();
  await db.insert(users).values({ id, email, passwordHash: await hashPassword(password), createdAt: new Date() });
  await startSession(id);
  redirect("/join");
}

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = Email.safeParse(formData.get("email"));
  const password = String(formData.get("password") ?? "");
  if (!email.success) return { error: email.error.issues[0].message };
  if (loginLocked(email.data)) return { error: "密码错误次数过多，请 15 分钟后再试" };

  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.email, email.data));
  // 账号不存在也走一遍校验，避免通过响应时间判断邮箱是否注册
  const ok = user ? await verifyPassword(password, user.passwordHash) : (await hashPassword(password), false);
  if (!user || !ok) {
    recordLoginFailure(email.data);
    return { error: "邮箱或密码错误" };
  }
  clearLoginFailures(email.data);
  await startSession(user.id);

  const [profile] = await db.select({ id: students.id }).from(students).where(eq(students.id, user.id));
  redirect(profile ? safeNext(formData.get("next"), "/me") : "/join");
}

export async function logout() {
  await endSession();
  redirect("/");
}
