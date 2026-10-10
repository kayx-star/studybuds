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

/** 两位同学的匹配度：时间重叠最重要，其次是学习风格 */
export function pairScore(a: Student, b: Student): Omit<PairMatch, "student"> {
  const sharedSlots = intersect(a.slots, b.slots);
  const time = sharedSlots.length / Math.max(1, Math.min(a.slots.length, b.slots.length));
  const pace = 1 - Math.abs(paceIndex(a.pace) - paceIndex(b.pace)) / 2;
  const modeOk = a.mode === "either" || b.mode === "either" || a.mode === b.mode;
  const goal = a.goal === b.goal ? 1 : 0.4;
  const sharedTags = intersect(a.tags, b.tags);
  const tags = jaccard(a.tags, b.tags);
  const size = Math.max(0, 1 - Math.abs(a.groupSize - b.groupSize) / 3);

  let score =
    0.4 * time + 0.15 * pace + 0.15 * (modeOk ? 1 : 0) + 0.1 * goal + 0.15 * tags + 0.05 * size;
  if (sharedSlots.length === 0) score *= 0.3;

  const reasons: Reason[] = [];
  reasons.push(sharedSlots.length > 0 ? { kind: "slots", slots: sharedSlots } : { kind: "noSlots" });
  if (pace === 1) reasons.push({ kind: "samePace" });
  if (a.goal === b.goal) reasons.push({ kind: "sameGoal" });
  if (sharedTags.length > 0) reasons.push({ kind: "sharedTags", tags: sharedTags });
  if (!modeOk) reasons.push({ kind: "modeConflict" });

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
    .filter((s) => s.id !== me.id && s.courses.includes(course))
    .map((s) => withRating({ student: s, ...pairScore(me, s) }, ratings.get(s.id)))
    .filter((m) => m.score > 0)
    .sort((x, y) => y.score - x.score)
    .slice(0, limit);
}

/** 互补匹配的候选：同课、有共同时间、线上线下不冲突 */
export function complementPool(me: Student, all: Student[], course: string, limit = 10) {
  return all
    .filter((s) => s.id !== me.id && s.courses.includes(course))
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
      if (commonSlots([...members, c]).length === 0) continue;
      const avg = members.reduce((sum, m) => sum + pairScore(m, c).score, 0) / members.length;
      if (!best || avg > best.avg) best = { s: c, avg };
    }
    if (!best) break;
    members.push(best.s);
  }
  return members;
}
