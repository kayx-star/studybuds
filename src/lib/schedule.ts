import { DAYS } from "./constants";

/** Default start time for each period */
export const PERIOD_START: Record<string, string> = { am: "09:00", pm: "14:00", eve: "19:00" };

const pad = (n: number) => String(n).padStart(2, "0");
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export type Suggestion = { date: string; start: string; slot: string };

/** Dates in the next two weeks that fall on shared free slots, for one-click session scheduling */
export function nextOccurrences(slots: string[], now: Date, limit = 6): Suggestion[] {
  const result: Suggestion[] = [];
  for (let i = 0; i < 14 && result.length < limit; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const dayKey = DAYS[(d.getDay() + 6) % 7].key; // getDay: 0 = Sunday
    for (const slot of slots) {
      const [day, period] = slot.split("-");
      if (day !== dayKey) continue;
      const start = PERIOD_START[period];
      // Skip slots that already started today
      if (i === 0 && `${pad(now.getHours())}:${pad(now.getMinutes())}` >= start) continue;
      result.push({ date: ymd(d), start, slot });
    }
  }
  return result.slice(0, limit);
}

const icsEscape = (s: string) => s.replace(/[\\;,]/g, (c) => "\\" + c).replace(/\n/g, "\\n");

/** Builds an .ics calendar file (floating local time, shown in the device's time zone) */
export function toIcs(e: {
  id: string;
  date: string;
  start: string;
  minutes: number;
  title: string;
  place: string;
  reminder: string;
}) {
  const [y, m, d] = e.date.split("-").map(Number);
  const [h, min] = e.start.split(":").map(Number);
  const begin = new Date(y, m - 1, d, h, min);
  const end = new Date(begin.getTime() + e.minutes * 60_000);
  const fmt = (t: Date) => `${ymd(t).replace(/-/g, "")}T${pad(t.getHours())}${pad(t.getMinutes())}00`;
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//study-buddy//CN",
    "BEGIN:VEVENT",
    `UID:${e.id}@study-buddy`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${fmt(begin)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${icsEscape(e.title)}`,
    `LOCATION:${icsEscape(e.place)}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT30M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsEscape(e.reminder)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
