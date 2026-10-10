import "server-only";
import data from "@/data/courses-nb-fall2026.json";

// Rutgers 新布朗斯维克 Fall 2026 本科课程（来自 Schedule of Classes 公开接口，已精简）。
// 学生可选填具体课程：存成 "198:111"（课程）或 "198:111#11389"（具体到 Index 班级）。

type RawCourse = { s: string; n: string; c: string; t: string; x: [string, string, string][] };
const COURSES = data as RawCourse[];

const byKey = new Map(COURSES.map((c) => [`${c.s}:${c.n}`, c]));
const byIndex = new Map<string, { course: RawCourse; section: string; instructor: string }>();
for (const c of COURSES) for (const [index, section, instructor] of c.x) byIndex.set(index, { course: c, section, instructor });

export type ClassRef = { subject: string; course: string; index?: string };

export function parseClassRef(id: string): ClassRef | null {
  const m = id.match(/^(\d{3}):(\d{3})(?:#(\d{5}))?$/);
  if (!m) return null;
  return { subject: m[1], course: m[2], index: m[3] };
}

/** 课程是否存在；带 Index 时还要求这个班属于这门课 */
export function isValidClass(id: string) {
  const ref = parseClassRef(id);
  if (!ref || !byKey.has(`${ref.subject}:${ref.course}`)) return false;
  if (!ref.index) return true;
  const sec = byIndex.get(ref.index);
  return !!sec && sec.course.s === ref.subject && sec.course.n === ref.course;
}

/** 课程名首字母大写：“INTRO COMPUTER SCI” → “Intro Computer Sci” */
const pretty = (t: string) => t.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase()).replace(/\bIi\b/g, "II").replace(/\bIii\b/g, "III");

export type ClassInfo = { id: string; code: string; title: string; index?: string; section?: string; instructor?: string };

export function classInfo(id: string): ClassInfo | null {
  const ref = parseClassRef(id);
  const c = ref && byKey.get(`${ref.subject}:${ref.course}`);
  if (!ref || !c) return null;
  const sec = ref.index ? byIndex.get(ref.index) : undefined;
  return {
    id,
    code: c.c,
    title: pretty(c.t),
    index: ref.index,
    section: sec?.section,
    instructor: sec?.instructor || undefined,
  };
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/**
 * 搜索课程：支持课程号（198:111、01:198:111、198111、111）、课程名关键词、5 位 Index。
 * preferSubjects 里的科目排在前面。
 */
export function searchCourses(query: string, preferSubjects: string[] = [], limit = 20): ClassInfo[] {
  const q = norm(query);
  if (!q) return [];
  const results: ClassInfo[] = [];

  // 5 位数字：按 Index 精确找到具体的班
  if (/^\d{5}$/.test(q)) {
    const sec = byIndex.get(q);
    if (sec) results.push(classInfo(`${sec.course.s}:${sec.course.n}#${q}`)!);
  }

  const digits = q.replace(/[^\d]/g, "");
  const words = q.split(" ").filter(Boolean);
  const matches = COURSES.filter((c) => {
    const code = c.c.replace(/[^\d]/g, ""); // 01198111
    if (digits.length >= 3 && /^[\d:\s-]+$/.test(q)) {
      // 纯数字/冒号：按课程号匹配（198:111 → 198111；111 → 课程号）
      return code.includes(digits) || c.n.startsWith(digits);
    }
    const hay = `${c.c} ${c.t}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });

  matches.sort((a, b) => {
    const pa = preferSubjects.includes(a.s) ? 0 : 1;
    const pb = preferSubjects.includes(b.s) ? 0 : 1;
    return pa - pb || (a.s + a.n).localeCompare(b.s + b.n);
  });
  for (const c of matches) {
    if (results.length >= limit) break;
    results.push(classInfo(`${c.s}:${c.n}`)!);
  }

  // 输入正好是一门课的课程号时，再列出它的各个班，方便直接选 Index
  if (matches.length === 1) {
    for (const [index] of matches[0].x.slice(0, limit - results.length)) {
      results.push(classInfo(`${matches[0].s}:${matches[0].n}#${index}`)!);
    }
  }
  return results;
}
