import type { Student } from "@/db/schema";
import { PACES, slotLabel } from "./constants";

export type PairMatch = {
  student: Student;
  score: number; // 0-100
  sharedSlots: string[];
  reasons: string[];
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

  const reasons: string[] = [];
  if (sharedSlots.length > 0) {
    const shown = sharedSlots.slice(0, 3).map(slotLabel).join("、");
    reasons.push(`${sharedSlots.length} 个共同空闲时段（${shown}${sharedSlots.length > 3 ? "等" : ""}）`);
  } else {
    reasons.push("暂无共同空闲时间");
  }
  if (pace === 1) reasons.push("学习节奏一致");
  if (a.goal === b.goal) reasons.push("学习目标相同");
  if (sharedTags.length > 0) reasons.push(`都喜欢${sharedTags.join("、")}`);
  if (!modeOk) reasons.push("线上/线下偏好不同");

  return { score: Math.round(score * 100), sharedSlots, reasons };
}

/** 为某门课推荐搭子，按匹配度排序 */
export function recommend(me: Student, all: Student[], course: string, limit = 8): PairMatch[] {
  return all
    .filter((s) => s.id !== me.id && s.courses.includes(course))
    .map((s) => ({ student: s, ...pairScore(me, s) }))
    .filter((m) => m.score > 0)
    .sort((x, y) => y.score - x.score)
    .slice(0, limit);
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
