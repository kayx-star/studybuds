import "server-only";
import data from "@/data/courses-nb-fall2026.json";

// Rutgers New Brunswick Fall 2026 undergraduate courses (from the public Schedule of Classes API, compacted).
// Students may add specific courses, stored as "198:111" (course) or "198:111#11389" (a specific section index).

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

/** Whether the course exists; with an index, the section must also belong to that course */
export function isValidClass(id: string) {
  const ref = parseClassRef(id);
  if (!ref || !byKey.has(`${ref.subject}:${ref.course}`)) return false;
  if (!ref.index) return true;
  const sec = byIndex.get(ref.index);
  return !!sec && sec.course.s === ref.subject && sec.course.n === ref.course;
}

/** Title-cases course names: "INTRO COMPUTER SCI" → "Intro Computer Sci" */
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
 * Searches courses by number (198:111, 01:198:111, 198111, 111), title keywords, or 5-digit index.
 * Subjects in preferSubjects are listed first.
 */
export function searchCourses(query: string, preferSubjects: string[] = [], limit = 20): ClassInfo[] {
  const q = norm(query);
  if (!q) return [];
  const results: ClassInfo[] = [];

  // 5 digits: look up the exact section by index
  if (/^\d{5}$/.test(q)) {
    const sec = byIndex.get(q);
    if (sec) results.push(classInfo(`${sec.course.s}:${sec.course.n}#${q}`)!);
  }

  const digits = q.replace(/[^\d]/g, "");
  const words = q.split(" ").filter(Boolean);
  const matches = COURSES.filter((c) => {
    const code = c.c.replace(/[^\d]/g, ""); // 01198111
    if (digits.length >= 3 && /^[\d:\s-]+$/.test(q)) {
      // Digits/colons only: match by course number (198:111 → 198111; 111 → course number)
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

  // When the input matches exactly one course, also list its sections so an index can be picked directly
  if (matches.length === 1) {
    for (const [index] of matches[0].x.slice(0, limit - results.length)) {
      results.push(classInfo(`${matches[0].s}:${matches[0].n}#${index}`)!);
    }
  }
  return results;
}
