// 语言配置：proxy、服务端和客户端组件都会用到，不能依赖 server-only 模块

export const LOCALES = ["zh", "en", "es"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "zh";
export const LOCALE_COOKIE = "NEXT_LOCALE";

export const LOCALE_NAMES: Record<Locale, string> = { zh: "中文", en: "English", es: "Español" };
export const HTML_LANG: Record<Locale, string> = { zh: "zh-CN", en: "en", es: "es" };

export const isLocale = (value: string | undefined | null): value is Locale =>
  !!value && (LOCALES as readonly string[]).includes(value);

/** 从 Accept-Language 里挑出最匹配的语言，如 "es-MX,es;q=0.9,en;q=0.8" → "es" */
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

/** 给站内路径加上语言前缀 */
export const localePath = (locale: Locale, path: string) => `/${locale}${path === "/" ? "" : path}`;
