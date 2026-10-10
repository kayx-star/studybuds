import { DAYS, slotLabel } from "./constants";

/** 各时段默认开始时间 */
export const PERIOD_START: Record<string, string> = { am: "09:00", pm: "14:00", eve: "19:00" };

const pad = (n: number) => String(n).padStart(2, "0");
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export type Suggestion = { date: string; start: string; label: string };

/** 未来两周内落在共同空闲时段上的日期，用于一键约自习 */
export function nextOccurrences(slots: string[], now: Date, limit = 6): Suggestion[] {
  const result: Suggestion[] = [];
  for (let i = 0; i < 14 && result.length < limit; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const dayKey = DAYS[(d.getDay() + 6) % 7].key; // getDay: 0=周日
    for (const slot of slots) {
      const [day, period] = slot.split("-");
      if (day !== dayKey) continue;
      const start = PERIOD_START[period];
      // 今天已经过了开始时间的不推荐
      if (i === 0 && `${pad(now.getHours())}:${pad(now.getMinutes())}` >= start) continue;
      result.push({ date: ymd(d), start, label: `${d.getMonth() + 1}月${d.getDate()}日 ${slotLabel(slot)}` });
    }
  }
  return result.slice(0, limit);
}

export function formatSession(date: string, start: string, minutes: number) {
  const [y, m, d] = date.split("-").map(Number);
  const weekday = DAYS[(new Date(y, m - 1, d).getDay() + 6) % 7].label;
  const [h, min] = start.split(":").map(Number);
  const endTotal = h * 60 + min + minutes;
  const end = `${pad(Math.floor(endTotal / 60) % 24)}:${pad(endTotal % 60)}`;
  return `${m}月${d}日 ${weekday} ${start}–${end}`;
}

const icsEscape = (s: string) => s.replace(/[\\;,]/g, (c) => "\\" + c).replace(/\n/g, "\\n");

/** 生成 .ics 日历文件（使用本地“浮动时间”，日历按手机所在时区显示） */
export function toIcs(e: { id: string; date: string; start: string; minutes: number; title: string; place: string }) {
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
    "DESCRIPTION:自习快开始了",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
