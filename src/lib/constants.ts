export const DAYS = [
  { key: "mon", label: "周一" },
  { key: "tue", label: "周二" },
  { key: "wed", label: "周三" },
  { key: "thu", label: "周四" },
  { key: "fri", label: "周五" },
  { key: "sat", label: "周六" },
  { key: "sun", label: "周日" },
] as const;

export const PERIODS = [
  { key: "am", label: "上午" },
  { key: "pm", label: "下午" },
  { key: "eve", label: "晚上" },
] as const;

export const ALL_SLOTS = DAYS.flatMap((d) => PERIODS.map((p) => `${d.key}-${p.key}`));

export function slotLabel(slot: string) {
  const [d, p] = slot.split("-");
  const day = DAYS.find((x) => x.key === d)?.label ?? d;
  const period = PERIODS.find((x) => x.key === p)?.label ?? p;
  return `${day}${period}`;
}

export const PACES = [
  { key: "slow", label: "稳扎稳打" },
  { key: "medium", label: "正常节奏" },
  { key: "fast", label: "快速推进" },
] as const;

export const MODES = [
  { key: "online", label: "线上" },
  { key: "offline", label: "线下" },
  { key: "either", label: "都可以" },
] as const;

export const GOALS = [
  { key: "pass", label: "顺利通过" },
  { key: "good", label: "冲击高分" },
  { key: "deep", label: "深入理解" },
] as const;

export const STYLE_TAGS = [
  "讨论交流",
  "安静自习",
  "刷题练习",
  "互相讲解",
  "笔记整理",
  "项目实践",
  "打卡监督",
  "考前冲刺",
] as const;

export const DIFFICULTIES = [
  { key: "easy", label: "基础" },
  { key: "medium", label: "中等" },
  { key: "hard", label: "挑战" },
] as const;

export type Pace = (typeof PACES)[number]["key"];
export type Mode = (typeof MODES)[number]["key"];
export type Goal = (typeof GOALS)[number]["key"];

export const labelOf = (list: readonly { key: string; label: string }[], key: string) =>
  list.find((x) => x.key === key)?.label ?? key;

/** 统一课程名：去空格、英文转大写，让 "cs 101" 和 "CS101" 视为同一门课 */
export function normalizeCourse(name: string) {
  return name.trim().replace(/\s+/g, "").toUpperCase();
}
