import { connection } from "next/server";
import { getI18n } from "@/i18n/server";
import type { Dict } from "@/i18n/zh";
import { geminiStatus } from "@/lib/gemini";

export function waitText(t: Dict, until: number) {
  const minutes = Math.ceil((until - Date.now()) / 60_000);
  return t.gemini.duration(Math.floor(minutes / 60), minutes % 60);
}

/**
 * Gemini 额度用完时提示用户正在使用普通版、多久后恢复。
 * 放在页面内容里而不是共用布局里：提交表单后布局不会重新渲染，页面会。
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
