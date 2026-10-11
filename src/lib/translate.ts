import "server-only";
import { createHash } from "node:crypto";
import { inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { translations } from "@/db/schema";
import type { Locale } from "@/i18n/config";
import { translateBatch } from "./gemini";

// User-written and Gemini-generated content is translated into all three languages and cached in the translations table,
// so a page never mixes languages when the locale changes. Personal names don't go through here.

const BATCH = 40;
const hashOf = (text: string) => createHash("sha256").update(text).digest("hex");

/** Text with no letters at all (numbers, symbols, URL fragments) needs no translation */
const needsTranslation = (text: string) => /\p{L}/u.test(text);

const clean = (texts: (string | null | undefined)[]) =>
  [...new Set(texts.map((t) => t?.trim()).filter((t): t is string => !!t && needsTranslation(t)))];

/** Ensures these texts have translations; missing ones go to Gemini in batches, and failures are skipped silently (the page shows the original) */
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

/** Returns a function mapping source text to the current-language translation, filling in missing translations first */
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
