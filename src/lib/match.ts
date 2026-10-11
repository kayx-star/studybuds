import type { ComplementPick, Student } from "@/db/schema";
import type { Dict } from "@/i18n/zh";
import { PACES } from "./constants";
import type { Rating } from "./ratings";

export type MatchMode = "similar" | "complement";

/** Match reasons are structured data, rendered per language at display time (see reasonText in i18n/format.ts) */
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
  | { kind: "sameCourse"; codes: string[] }
  | { kind: "sameSection"; indexes: string[] }
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

/** Gender preference is a hard, two-way filter; "prefer not to say" only matches people with "no preference" */
const genderOk = (pref: Student["genderPref"], gender: Student["gender"]) => pref === "any" || pref === gender;
export const compatible = (a: Student, b: Student) => genderOk(a.genderPref, b.gender) && genderOk(b.genderPref, a.gender);

/** How well b's campus suits a: 1 if preferred; without a preference, 1 for the same campus, 0.5 otherwise; 0.6 if b didn't say */
function campusFit(a: Student, b: Student) {
  if (!b.campus) return 0.6;
  if (a.campusPref.length > 0) return a.campusPref.includes(b.campus as never) ? 1 : 0.2;
  return a.campus && a.campus === b.campus ? 1 : 0.5;
}

/** How well b's personality suits a's preference */
function personalityFit(a: Student, b: Student) {
  if (a.personalityPref === "any") return 1;
  if (!b.personality) return 0.6;
  if (b.personality === a.personalityPref) return 1;
  return b.personality === "ambivert" ? 0.6 : 0.2;
}

/** Match score between two students (0-100): shared free time matters most, then study style, campus and personality */
export function pairScore(a: Student, b: Student): Omit<PairMatch, "student"> {
  const sharedSlots = intersect(a.slots, b.slots);
  const time = sharedSlots.length / Math.max(1, Math.min(a.slots.length, b.slots.length));
  const pace = 1 - Math.abs(paceIndex(a.pace) - paceIndex(b.pace)) / 2;
  const modeOk = a.mode === "either" || b.mode === "either" || a.mode === b.mode;
  const goal = a.goal === b.goal ? 1 : 0.4;
  const sharedTags = intersect(a.tags, b.tags);
  const tags = jaccard(a.tags, b.tags);
  const size = Math.max(0, 1 - Math.abs(a.groupSize - b.groupSize) / 3);

  // Average both directions: does b suit a's preferences, and does a suit b's
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

/** Peer-rating adjustment: 5 stars +6, 3 stars ±0, 1 star -6 */
function withRating(m: PairMatch, rating?: Rating): PairMatch {
  if (!rating) return m;
  const score = Math.max(0, Math.min(100, Math.round(m.score + (rating.avg - 3) * 3)));
  return { ...m, score, reasons: [...m.reasons, { kind: "rating", avg: rating.avg, count: rating.count }] };
}

/** Course-level bonus: same course +10, same section (index) another +8; only courses in the current subject count */
function withClasses(m: PairMatch, me: Student, subject: string): PairMatch {
  const mine = me.classes.filter((c) => c.startsWith(subject + ":"));
  const theirs = m.student.classes.filter((c) => c.startsWith(subject + ":"));
  if (mine.length === 0 || theirs.length === 0) return m;
  const courseOf = (c: string) => c.split("#")[0];
  const sameCourse = [...new Set(mine.map(courseOf).filter((c) => theirs.some((x) => courseOf(x) === c)))];
  const sameSection = mine.filter((c) => c.includes("#") && theirs.includes(c)).map((c) => c.split("#")[1]);
  if (sameCourse.length === 0) return m;
  const reasons: Reason[] = [{ kind: "sameCourse", codes: sameCourse }];
  if (sameSection.length) reasons.push({ kind: "sameSection", indexes: sameSection });
  const score = Math.min(100, m.score + 10 + (sameSection.length ? 8 : 0));
  return { ...m, score, reasons: [...reasons, ...m.reasons] };
}

/** Recommends buddies for a subject, sorted by match score */
export function recommend(
  me: Student,
  all: Student[],
  course: string,
  ratings: Map<string, Rating> = new Map(),
  limit = 8,
): PairMatch[] {
  return all
    .filter((s) => s.id !== me.id && s.courses.includes(course) && compatible(me, s))
    .map((s) => withRating(withClasses({ student: s, ...pairScore(me, s) }, me, course), ratings.get(s.id)))
    .filter((m) => m.score > 0)
    .sort((x, y) => y.score - x.score)
    .slice(0, limit);
}

/** Candidates for complementary matching: same subject, shared free time, compatible online/in-person mode */
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

/** Rule-based complementary matching (when Gemini is unavailable): are my weak topics in their strengths, and vice versa */
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

/** Rule-based grouping (fallback when Gemini is unavailable): greedily add whoever has the best average match with current members while everyone still shares free time */
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
