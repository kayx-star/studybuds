// Option keys used across the app. The `label`s here are English and are only used in Gemini prompts;
// all user-facing text comes from the i18n dictionaries in src/i18n/.

export const DAYS = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
] as const;

export const PERIODS = [
  { key: "am", label: "morning" },
  { key: "pm", label: "afternoon" },
  { key: "eve", label: "evening" },
] as const;

export const ALL_SLOTS = DAYS.flatMap((d) => PERIODS.map((p) => `${d.key}-${p.key}`));

export function slotLabel(slot: string) {
  const [d, p] = slot.split("-");
  const day = DAYS.find((x) => x.key === d)?.label ?? d;
  const period = PERIODS.find((x) => x.key === p)?.label ?? p;
  return `${day} ${period}`;
}

export const PACES = [
  { key: "slow", label: "slow and steady" },
  { key: "medium", label: "normal pace" },
  { key: "fast", label: "fast-paced" },
] as const;

export const MODES = [
  { key: "online", label: "online" },
  { key: "offline", label: "in person" },
  { key: "either", label: "either" },
] as const;

export const GOALS = [
  { key: "pass", label: "just pass" },
  { key: "good", label: "top grades" },
  { key: "deep", label: "deep understanding" },
] as const;

// Style tags are stored in the database as these Chinese values (they act as stable keys);
// UI text for them lives in the i18n dictionaries (options.tags).
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
  { key: "easy", label: "basic" },
  { key: "medium", label: "medium" },
  { key: "hard", label: "challenging" },
] as const;

export const GENDERS = [
  { key: "male", label: "male" },
  { key: "female", label: "female" },
  { key: "nonbinary", label: "non-binary" },
  { key: "undisclosed", label: "prefer not to say" },
] as const;

export const GENDER_PREFS = [
  { key: "any", label: "any" },
  { key: "male", label: "male" },
  { key: "female", label: "female" },
  { key: "nonbinary", label: "non-binary" },
] as const;

export const CAMPUSES = [
  { key: "busch", label: "Busch" },
  { key: "livingston", label: "Livingston" },
  { key: "college-ave", label: "College Avenue" },
  { key: "cook-douglass", label: "Cook/Douglass" },
] as const;

export const PERSONALITIES = [
  { key: "introvert", label: "introverted" },
  { key: "ambivert", label: "in between" },
  { key: "extrovert", label: "extroverted" },
] as const;

export const PERSONALITY_PREFS = [
  { key: "any", label: "any" },
  { key: "introvert", label: "introverted" },
  { key: "extrovert", label: "extroverted" },
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
