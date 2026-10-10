import type { ComplementPick, Student } from "@/db/schema";
import type { Dict } from "@/i18n/zh";
import { PACES } from "./constants";
import type { Rating } from "./ratings";

export type MatchMode = "similar" | "complement";

/** 推荐理由存成结构化数据，显示时再按语言渲染（见 i18n/format.ts 的 reasonText） */
export type Reason =
  | { kind: "slots"; slots: string[] }
  | { kind: "noSlots" }
  | { kind: "samePace" }
  | { kind: "sameGoal" }
  | { kind: "sharedTags"; tags: string[] }
  | { kind: "modeConflict" }
  | { kind: "sameCampus"; campus: string }
  | { kind: "preferredCampus"; campus: string }
  | { kind: "otherCampus"; campus: string }
  | { kind: "personalityFit" }
  | { kind: "rating"; avg: number; count: number };

export type PairMatch = {
  student: Student;
  score: number; // 0-100
  sharedSlots: string[];
  reasons: Reason[];
};

const intersect = (a: string[], b: string[]) => a.filter((x) => b.includes(x));

function jaccard(a: string[], b: string[]) {
  if (a.length === 0 && b.length === 0) return 0.5;
  const union = new Set([...a, ...b]).size;
  return intersect(a, b).length / union;
}

const paceIndex = (p: string) => PACES.findIndex((x) => x.key === p);

/** 性别偏好是硬性条件，且双向生效；“不愿透露”的人只匹配选了“都可以”的人 */
const genderOk = (pref: Student["genderPref"], gender: Student["gender"]) => pref === "any" || pref === gender;
export const compatible = (a: Student, b: Student) => genderOk(a.genderPref, b.gender) && genderOk(b.genderPref, a.gender);

/** a 对 b 的校区满意度：在偏好里 1；没设偏好时同校区 1、不同 0.5；对方没填 0.6 */
function campusFit(a: Student, b: Student) {
  if (!b.campus) return 0.6;
  if (a.campusPref.length > 0) return a.campusPref.includes(b.campus as never) ? 1 : 0.2;
  return a.campus && a.campus === b.campus ? 1 : 0.5;
}

/** a 对 b 的性格满意度 */
function personalityFit(a: Student, b: Student) {
  if (a.personalityPref === "any") return 1;
  if (!b.personality) return 0.6;
  if (b.personality === a.personalityPref) return 1;
  return b.personality === "ambivert" ? 0.6 : 0.2;
}

/** 两位同学的匹配度（0-100）：时间重叠最重要，其次是学习风格、校区和性格 */
export function pairScore(a: Student, b: Student): Omit<PairMatch, "student"> {
  const sharedSlots = intersect(a.slots, b.slots);
  const time = sharedSlots.length / Math.max(1, Math.min(a.slots.length, b.slots.length));
  const pace = 1 - Math.abs(paceIndex(a.pace) - paceIndex(b.pace)) / 2;
  const modeOk = a.mode === "either" || b.mode === "either" || a.mode === b.mode;
  const goal = a.goal === b.goal ? 1 : 0.4;
  const sharedTags = intersect(a.tags, b.tags);
  const tags = jaccard(a.tags, b.tags);
  const size = Math.max(0, 1 - Math.abs(a.groupSize - b.groupSize) / 3);

  // 双向取平均：既看 b 合不合 a 的偏好，也看 a 合不合 b 的偏好
  const campus = (campusFit(a, b) + campusFit(b, a)) / 2;
  const personality = (personalityFit(a, b) + personalityFit(b, a)) / 2;

  let score =
    0.35 * time +
    0.12 * pace +
    0.12 * (modeOk ? 1 : 0) +
    0.08 * goal +
    0.12 * tags +
    0.04 * size +
    0.09 * campus +
    0.08 * personality;
  if (sharedSlots.length === 0) score *= 0.3;

  const reasons: Reason[] = [];
  reasons.push(sharedSlots.length > 0 ? { kind: "slots", slots: sharedSlots } : { kind: "noSlots" });
  if (pace === 1) reasons.push({ kind: "samePace" });
  if (a.goal === b.goal) reasons.push({ kind: "sameGoal" });
  if (sharedTags.length > 0) reasons.push({ kind: "sharedTags", tags: sharedTags });
  if (!modeOk) reasons.push({ kind: "modeConflict" });
  if (b.campus) {
    if (a.campus === b.campus) reasons.push({ kind: "sameCampus", campus: b.campus });
    else if (a.campusPref.includes(b.campus as never)) reasons.push({ kind: "preferredCampus", campus: b.campus });
    else if (a.campusPref.length > 0) reasons.push({ kind: "otherCampus", campus: b.campus });
  }
  if (a.personalityPref !== "any" && b.personality === a.personalityPref) reasons.push({ kind: "personalityFit" });

  return { score: Math.round(score * 100), sharedSlots, reasons };
}

/** 互评加减分：满分 5 星 +6，3 星不变，1 星 -6 */
function withRating(m: PairMatch, rating?: Rating): PairMatch {
  if (!rating) return m;
  const score = Math.max(0, Math.min(100, Math.round(m.score + (rating.avg - 3) * 3)));
  return { ...m, score, reasons: [...m.reasons, { kind: "rating", avg: rating.avg, count: rating.count }] };
}

/** 为某门课推荐搭子，按匹配度排序 */
export function recommend(
  me: Student,
  all: Student[],
  course: string,
  ratings: Map<string, Rating> = new Map(),
  limit = 8,
): PairMatch[] {
  return all
    .filter((s) => s.id !== me.id && s.courses.includes(course) && compatible(me, s))
    .map((s) => withRating({ student: s, ...pairScore(me, s) }, ratings.get(s.id)))
    .filter((m) => m.score > 0)
    .sort((x, y) => y.score - x.score)
    .slice(0, limit);
}

/** 互补匹配的候选：同课、有共同时间、线上线下不冲突 */
export function complementPool(me: Student, all: Student[], course: string, limit = 10) {
  return all
    .filter((s) => s.id !== me.id && s.courses.includes(course) && compatible(me, s))
    .filter((s) => intersect(me.slots, s.slots).length > 0)
    .filter((s) => me.mode === "either" || s.mode === "either" || me.mode === s.mode)
    .sort((a, b) => intersect(me.slots, b.slots).length - intersect(me.slots, a.slots).length)
    .slice(0, limit);
}

const terms = (text: string) =>
  text
    .split(/[,，、;；。\s\n/]+/)
    .map((t) => t.trim().toUpperCase())
    .filter((t) => t.length >= 2);

/** 规则版互补匹配（Gemini 不可用时）：看我的弱项是否出现在对方擅长里，反之亦然 */
export function ruleComplements(me: Student, pool: Student[], t: Dict): ComplementPick[] {
  const hits = (wants: string, has: string) => {
    const hay = has.toUpperCase();
    return terms(wants).filter((t) => hay.includes(t));
  };
  return pool.map((s) => {
    const theyHelpMe = hits(me.weak, s.strong);
    const iHelpThem = hits(s.weak, me.strong);
    const score = Math.min(100, theyHelpMe.length * 30 + iHelpThem.length * 30 + (theyHelpMe.length && iHelpThem.length ? 20 : 0));
    const parts = [
      theyHelpMe.length ? t.reason.theyHelpYou(t.list(theyHelpMe)) : null,
      iHelpThem.length ? t.reason.youHelpThem(t.list(iHelpThem)) : null,
    ].filter(Boolean);
    return { id: s.id, score, reason: parts.join("; ") || t.reason.noComplement };
  });
}

export function commonSlots(members: Student[]) {
  return members.reduce<string[]>((acc, s) => intersect(acc, s.slots), members[0]?.slots ?? []);
}

/** 规则版组队（Gemini 不可用时的兜底）：贪心加入与现有成员平均匹配度最高、且仍有共同时间的人 */
export function greedyGroup(me: Student, candidates: Student[], size: number): Student[] {
  const members = [me];
  while (members.length < size) {
    let best: { s: Student; avg: number } | null = null;
    for (const c of candidates) {
      if (members.includes(c)) continue;
      if (!members.every((m) => compatible(m, c))) continue;
      if (commonSlots([...members, c]).length === 0) continue;
      const avg = members.reduce((sum, m) => sum + pairScore(m, c).score, 0) / members.length;
      if (!best || avg > best.avg) best = { s: c, avg };
    }
    if (!best) break;
    members.push(best.s);
  }
  return members;
}
