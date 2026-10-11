import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { lang } from "next/root-params";
import { LOCALE_COOKIE, isLocale, type Locale } from "./config";
import { dictFor } from "./dicts";

/** Server components: read the locale from the [lang] URL segment */
export async function getI18n() {
  const locale = await lang();
  if (!isLocale(locale)) notFound();
  return { locale, t: dictFor(locale) };
}

/** Server Actions can't read root params, so use the cookie the proxy keeps in sync */
export async function getActionI18n() {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale: Locale = isLocale(value) ? value : "zh";
  return { locale, t: dictFor(locale) };
}
