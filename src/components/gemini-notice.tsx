import { connection } from "next/server";
import { getI18n } from "@/i18n/server";
import type { Dict } from "@/i18n/zh";
import { geminiStatus } from "@/lib/gemini";

export function waitText(t: Dict, until: number) {
  const minutes = Math.ceil((until - Date.now()) / 60_000);
  return t.gemini.duration(Math.floor(minutes / 60), minutes % 60);
}

/**
 * When Gemini's quota runs out, tells users they're on the basic version and when it resumes.
 * Rendered inside page content rather than the shared layout: layouts don't re-render after a form action, pages do.
 */
export async function GeminiNotice() {
  await connection();
  const { t } = await getI18n();
  const { mainPausedUntil, translatePausedUntil } = geminiStatus();
  if (!mainPausedUntil && !translatePausedUntil) return null;
  return (
    <div className="space-y-1 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
      {mainPausedUntil && <p>{t.gemini.quotaBanner(waitText(t, mainPausedUntil))}</p>}
      {translatePausedUntil && <p>{t.gemini.translateBanner(waitText(t, translatePausedUntil))}</p>}
    </div>
  );
}
