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

// 以下 label 只用于给 Gemini 的提示词；界面文字在 i18n 字典里
export const GENDERS = [
  { key: "male", label: "男" },
  { key: "female", label: "女" },
  { key: "nonbinary", label: "非二元" },
  { key: "undisclosed", label: "不愿透露" },
] as const;

export const GENDER_PREFS = [
  { key: "any", label: "都可以" },
  { key: "male", label: "男生" },
  { key: "female", label: "女生" },
  { key: "nonbinary", label: "非二元" },
] as const;

export const CAMPUSES = [
  { key: "busch", label: "Busch" },
  { key: "livingston", label: "Livingston" },
  { key: "college-ave", label: "College Avenue" },
  { key: "cook-douglass", label: "Cook/Douglass" },
] as const;

export const PERSONALITIES = [
  { key: "introvert", label: "偏内向" },
  { key: "ambivert", label: "介于之间" },
  { key: "extrovert", label: "偏外向" },
] as const;

export const PERSONALITY_PREFS = [
  { key: "any", label: "都可以" },
  { key: "introvert", label: "内向" },
  { key: "extrovert", label: "外向" },
] as const;

export type Pace = (typeof PACES)[number]["key"];
export type Mode = (typeof MODES)[number]["key"];
export type Goal = (typeof GOALS)[number]["key"];
export type Gender = (typeof GENDERS)[number]["key"];
export type GenderPref = (typeof GENDER_PREFS)[number]["key"];
export type Campus = (typeof CAMPUSES)[number]["key"];
export type Personality = (typeof PERSONALITIES)[number]["key"];
export type PersonalityPref = (typeof PERSONALITY_PREFS)[number]["key"];

export const labelOf = (list: readonly { key: string; label: string }[], key: string) =>
  list.find((x) => x.key === key)?.label ?? key;
