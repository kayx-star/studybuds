import { pinyin } from "pinyin-pro";
import type { Locale } from "./config";

const HAN = /[㐀-鿿]+/g;

/** 英文/西语界面把中文昵称转成拼音（小林 → Xiaolin）；中文界面和非中文昵称保持原样 */
export function displayName(name: string, locale: Locale) {
  if (locale === "zh") return name;
  return name.replace(HAN, (run) => {
    const word = pinyin(run, { toneType: "none", type: "array", v: true }).join("");
    return word.charAt(0).toUpperCase() + word.slice(1);
  });
}

/** 只换显示用的 name，其余字段（匹配、发给 Gemini 用的数据）不变 */
export const localizeNames = <T extends { name: string }>(list: T[], locale: Locale): T[] =>
  locale === "zh" ? list : list.map((s) => ({ ...s, name: displayName(s.name, locale) }));
