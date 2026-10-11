// Locale config shared by the proxy, server and client components (must not import server-only modules)

export const LOCALES = ["zh", "en", "es"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "zh";
export const LOCALE_COOKIE = "NEXT_LOCALE";

// Each language is shown in its own script so speakers can find it
export const LOCALE_NAMES: Record<Locale, string> = { zh: "中文", en: "English", es: "Español" };
export const HTML_LANG: Record<Locale, string> = { zh: "zh-CN", en: "en", es: "es" };

export const isLocale = (value: string | undefined | null): value is Locale =>
  !!value && (LOCALES as readonly string[]).includes(value);

/** Picks the best supported language from Accept-Language, e.g. "es-MX,es;q=0.9,en;q=0.8" → "es" */
export function matchAcceptLanguage(header: string | null): Locale {
  if (!header) return DEFAULT_LOCALE;
  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = Number(params.find((p) => p.trim().startsWith("q="))?.split("=")[1] ?? 1);
      return { base: tag.toLowerCase().split("-")[0], q: Number.isFinite(q) ? q : 0 };
    })
    .sort((a, b) => b.q - a.q);
  return ranked.find((r) => isLocale(r.base))?.base as Locale | undefined ?? DEFAULT_LOCALE;
}

/** Prefixes a site path with the locale */
export const localePath = (locale: Locale, path: string) => `/${locale}${path === "/" ? "" : path}`;
