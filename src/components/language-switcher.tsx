"use client";

import { useRouter } from "next/navigation";
import { LOCALES, LOCALE_NAMES, type Locale } from "@/i18n/config";

/** Switches language by replacing the locale segment of the URL, keeping the page and query string.
 *  Reads window.location only on change (reading the URL during render would block prerendering) */
export function LanguageSwitcher({ locale, label }: { locale: Locale; label: string }) {
  const router = useRouter();

  return (
    <label className="flex items-center gap-1">
      <span aria-hidden>🌐</span>
      <span className="sr-only">{label}</span>
      <select
        value={locale}
        onChange={(e) => {
          const { pathname, search } = window.location;
          const rest = pathname.split("/").slice(2).join("/");
          router.push(`/${e.target.value}${rest ? "/" + rest : ""}${search}`);
        }}
        className="cursor-pointer rounded-lg border border-line bg-surface px-2 py-1 text-sm text-fg"
      >
        {LOCALES.map((l) => (
          <option key={l} value={l}>
            {LOCALE_NAMES[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
