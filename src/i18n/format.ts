import { HTML_LANG, type Locale } from "./config";
import type { Reason } from "@/lib/match";
import type { Dict } from "./zh";

type DayKey = keyof Dict["options"]["days"];
type PeriodKey = keyof Dict["options"]["periods"];

export function slotLabel(t: Dict, slot: string) {
  const [d, p] = slot.split("-");
  return t.slot(t.options.days[d as DayKey] ?? d, t.options.periods[p as PeriodKey] ?? p);
}

export const slotList = (t: Dict, slots: string[]) => t.list(slots.map((s) => slotLabel(t, s)));

export const campusLabel = (t: Dict, campus: string) =>
  t.options.campuses[campus as keyof Dict["options"]["campuses"]] ?? campus;

export const tagLabel = (t: Dict, tag: string) => t.options.tags[tag] ?? tag;

const pad = (n: number) => String(n).padStart(2, "0");

/** 如“10月12日周一”“Mon, Oct 12”“lun, 12 oct” */
export function formatDay(locale: Locale, date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat(HTML_LANG[locale], { month: "short", day: "numeric", weekday: "short" }).format(
    new Date(y, m - 1, d),
  );
}

export function formatSession(locale: Locale, date: string, start: string, minutes: number) {
  const [h, min] = start.split(":").map(Number);
  const endTotal = h * 60 + min + minutes;
  return `${formatDay(locale, date)} ${start}–${pad(Math.floor(endTotal / 60) % 24)}:${pad(endTotal % 60)}`;
}

export const formatDateTime = (locale: Locale, d: Date) =>
  new Intl.DateTimeFormat(HTML_LANG[locale], { dateStyle: "medium", timeStyle: "short" }).format(d);

export function reasonText(t: Dict, r: Reason) {
  switch (r.kind) {
    case "slots":
      return t.reason.slots(r.slots.length, slotList(t, r.slots.slice(0, 3)), r.slots.length > 3);
    case "noSlots":
      return t.reason.noSlots;
    case "samePace":
      return t.reason.samePace;
    case "sameGoal":
      return t.reason.sameGoal;
    case "sharedTags":
      return t.reason.sharedTags(t.list(r.tags.map((tag) => tagLabel(t, tag))));
    case "modeConflict":
      return t.reason.modeConflict;
    case "sameCampus":
      return t.reason.sameCampus(campusLabel(t, r.campus));
    case "preferredCampus":
      return t.reason.preferredCampus(campusLabel(t, r.campus));
    case "otherCampus":
      return t.reason.otherCampus(campusLabel(t, r.campus));
    case "personalityFit":
      return t.reason.personalityFit;
    case "rating":
      return t.reason.rating(r.avg.toFixed(1), r.count);
  }
}
