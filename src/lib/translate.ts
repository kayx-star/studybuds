import "server-only";
import { createHash } from "node:crypto";
import { inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { translations } from "@/db/schema";
import type { Locale } from "@/i18n/config";
import { translateBatch } from "./gemini";

// 用户写的内容和 Gemini 生成的内容会被翻译成三种语言并缓存在 translations 表，
// 这样页面切换语言时不会混入其他语言。昵称等人名不经过这里。

const BATCH = 40;
const hashOf = (text: string) => createHash("sha256").update(text).digest("hex");

/** 没有任何字母/汉字的内容（数字、符号、网址片段）不需要翻译 */
const needsTranslation = (text: string) => /\p{L}/u.test(text);

const clean = (texts: (string | null | undefined)[]) =>
  [...new Set(texts.map((t) => t?.trim()).filter((t): t is string => !!t && needsTranslation(t)))];

/** 确保这些文字都有翻译；缺的批量交给 Gemini，失败时静默跳过（页面退回显示原文） */
export async function ensureTranslations(texts: (string | null | undefined)[]) {
  const unique = clean(texts);
  if (unique.length === 0) return;
  const db = await getDb();
  const hashes = unique.map(hashOf);
  const have = new Set(
    (await db.select({ hash: translations.hash }).from(translations).where(inArray(translations.hash, hashes))).map(
      (r) => r.hash,
    ),
  );
  const missing = unique.filter((_, i) => !have.has(hashes[i]));

  for (let i = 0; i < missing.length; i += BATCH) {
    const chunk = missing.slice(i, i + BATCH);
    const rows = await translateBatch(chunk);
    if (!rows) return;
    const values = chunk
      .map((source, j) => (rows[j] ? { hash: hashOf(source), source, ...rows[j]! } : null))
      .filter((v) => v !== null);
    if (values.length > 0) await db.insert(translations).values(values).onConflictDoNothing();
  }
}

export type Translate = (text: string | null | undefined) => string;

/** 返回一个把原文换成当前语言译文的函数；先补齐缺失的翻译 */
export async function getTranslator(texts: (string | null | undefined)[], locale: Locale): Promise<Translate> {
  const unique = clean(texts);
  if (unique.length === 0) return (t) => t ?? "";
  await ensureTranslations(unique);
  const db = await getDb();
  const rows = await db
    .select()
    .from(translations)
    .where(inArray(translations.hash, unique.map(hashOf)));
  const map = new Map(rows.map((r) => [r.source, r[locale]]));
  return (t) => (t ? (map.get(t.trim()) ?? t) : "");
}
