import "server-only";
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { and, eq, gt, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { cache } from "react";
import { getDb } from "@/db";
import { authSessions } from "@/db/schema";

const COOKIE = "session";
const MAX_AGE_DAYS = 30;
const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

// ---------- 密码 ----------

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [algo, salt, hash] = stored.split("$");
  if (algo !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const actual = await scryptAsync(password, Buffer.from(salt, "base64"), expected.length);
  return timingSafeEqual(actual, expected);
}

// ---------- 会话 ----------

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export async function startSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const db = await getDb();
  await db.insert(authSessions).values({
    tokenHash: sha256(token),
    userId,
    expiresAt: new Date(Date.now() + MAX_AGE_DAYS * 86400_000),
  });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_DAYS * 86400,
  });
}

export async function endSession() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) {
    const db = await getDb();
    await db.delete(authSessions).where(eq(authSessions.tokenHash, sha256(token)));
  }
  store.delete(COOKIE);
}

/** 当前登录用户 id（同时也是 TA 的学生资料 id），未登录返回 null；同一次请求内只查一次库 */
export const currentStudentId = cache(async (): Promise<string | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const db = await getDb();
  const [row] = await db
    .select({ userId: authSessions.userId })
    .from(authSessions)
    // 过期判断交给数据库（unixepoch() 为当前秒数），渲染期间不能直接用 new Date()
    .where(and(eq(authSessions.tokenHash, sha256(token)), gt(authSessions.expiresAt, sql`(unixepoch())`)));
  return row?.userId ?? null;
});

// ---------- 登录失败限流（单机内存版，上线多实例时需换成数据库/Redis） ----------

const failures = new Map<string, { count: number; until: number }>();
const LIMIT = 5;
const WINDOW_MS = 15 * 60_000;

export function loginLocked(email: string) {
  const f = failures.get(email);
  return !!f && f.count >= LIMIT && f.until > Date.now();
}

export function recordLoginFailure(email: string) {
  const f = failures.get(email);
  const fresh = !f || f.until < Date.now();
  failures.set(email, { count: fresh ? 1 : f.count + 1, until: Date.now() + WINDOW_MS });
}

export function clearLoginFailures(email: string) {
  failures.delete(email);
}
