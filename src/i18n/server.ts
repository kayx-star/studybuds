import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { lang } from "next/root-params";
import { LOCALE_COOKIE, isLocale, type Locale } from "./config";
import { dictFor } from "./dicts";

/** 服务端组件：从网址的 [lang] 段读取语言 */
export async function getI18n() {
  const locale = await lang();
  if (!isLocale(locale)) notFound();
  return { locale, t: dictFor(locale) };
}

/** Server Action 读不到 root params，改用 proxy 同步写入的 cookie */
export async function getActionI18n() {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale: Locale = isLocale(value) ? value : "zh";
  return { locale, t: dictFor(locale) };
}
