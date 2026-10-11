import { pinyin } from "pinyin-pro";
import type { Locale } from "./config";

const HAN = /[㐀-鿿]+/g;

/** On English/Spanish pages, Chinese nicknames are shown in pinyin (小林 → Xiaolin); Chinese pages and non-Chinese names are unchanged */
export function displayName(name: string, locale: Locale) {
  if (locale === "zh") return name;
  return name.replace(HAN, (run) => {
    const word = pinyin(run, { toneType: "none", type: "array", v: true }).join("");
    return word.charAt(0).toUpperCase() + word.slice(1);
  });
}

/** Only the displayed name changes; other fields (used for matching and Gemini) stay the same */
export const localizeNames = <T extends { name: string }>(list: T[], locale: Locale): T[] =>
  locale === "zh" ? list : list.map((s) => ({ ...s, name: displayName(s.name, locale) }));
