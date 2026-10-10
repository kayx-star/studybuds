import type { Locale } from "./config";
import { en } from "./en";
import { es } from "./es";
import { zh, type Dict } from "./zh";

const DICTS: Record<Locale, Dict> = { zh, en, es };

export const dictFor = (locale: Locale) => DICTS[locale];
