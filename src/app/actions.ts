"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { getRatings } from "@/db/queries";
import { complements, groups, students, type Student } from "@/db/schema";
import { localePath } from "@/i18n/config";
import { slotList } from "@/i18n/format";
import { getActionI18n } from "@/i18n/server";
import type { Dict } from "@/i18n/zh";
import { ALL_SLOTS, GOALS, MODES, PACES, STYLE_TAGS, normalizeCourse } from "@/lib/constants";
import { analyzeBio, planGroup, rankComplements } from "@/lib/gemini";
import { commonSlots, complementPool, greedyGroup, recommend, ruleComplements, type MatchMode } from "@/lib/match";
import { currentStudentId } from "@/lib/session";

const keys = <T extends readonly { key: string }[]>(list: T) =>
  list.map((x) => x.key) as [T[number]["key"], ...T[number]["key"][]];

const profileSchema = (e: Dict["join"]["errors"]) =>
  z.object({
    name: z.string().trim().min(1, e.name).max(20, e.nameLong),
    contact: z.string().trim().min(1, e.contact).max(50),
    courses: z
      .string()
      .transform((s) => [...new Set(s.split(/[,，、;；\n]/).map(normalizeCourse).filter(Boolean))])
      .pipe(z.array(z.string().max(30)).min(1, e.courses).max(8, e.coursesMany)),
    slots: z.array(z.enum(ALL_SLOTS)).min(1, e.slots),
    pace: z.enum(keys(PACES), { message: e.pace }),
    mode: z.enum(keys(MODES), { message: e.mode }),
    goal: z.enum(keys(GOALS), { message: e.goal }),
    tags: z.array(z.enum(STYLE_TAGS)),
    groupSize: z.coerce.number().int().min(2).max(6),
    bio: z.string().trim().max(500, e.bioLong),
    strong: z.string().trim().max(200, e.strongLong),
    weak: z.string().trim().max(200, e.weakLong),
  });

export type JoinState = { error?: string };

export async function saveProfile(_prev: JoinState, formData: FormData): Promise<JoinState> {
  const { locale, t } = await getActionI18n();
  const parsed = profileSchema(t.join.errors).safeParse({
    name: formData.get("name"),
    contact: formData.get("contact"),
    courses: formData.get("courses") ?? "",
    slots: formData.getAll("slots"),
    pace: formData.get("pace"),
    mode: formData.get("mode"),
    goal: formData.get("goal"),
    tags: formData.getAll("tags"),
    groupSize: formData.get("groupSize"),
    bio: formData.get("bio") ?? "",
    strong: formData.get("strong") ?? "",
    weak: formData.get("weak") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;

  const sid = await currentStudentId();
  if (!sid) return { error: t.join.errors.sessionExpired };
  const db = await getDb();
  const [existing] = await db.select().from(students).where(eq(students.id, sid));

  // 自我介绍变了才重新请 Gemini 分析
  let aiSummary = existing?.aiSummary ?? null;
  let tags: string[] = data.tags;
  if (data.bio !== existing?.bio) {
    const analysis = await analyzeBio(data.bio, t.geminiLanguage);
    aiSummary = analysis?.summary ?? null;
    if (analysis) tags = [...new Set([...tags, ...analysis.tags])];
  }

  if (existing) {
    await db.update(students).set({ ...data, tags, aiSummary }).where(eq(students.id, existing.id));
    // 擅长/薄弱或课程变了，之前的互补匹配结果就不准了
    if (data.strong !== existing.strong || data.weak !== existing.weak || data.courses.join() !== existing.courses.join()) {
      await db.delete(complements).where(eq(complements.studentId, existing.id));
    }
  } else {
    // 资料 id 与账号 id 相同
    await db.insert(students).values({ ...data, tags, aiSummary, id: sid, createdAt: new Date() });
  }
  redirect(localePath(locale, "/me"));
}

export async function formGroup(formData: FormData) {
  const { locale, t } = await getActionI18n();
  const to = (path: string) => localePath(locale, path);
  const sid = await currentStudentId();
  if (!sid) redirect(to("/login"));
  const course = String(formData.get("course") ?? "");
  const mode: MatchMode = formData.get("mode") === "complement" ? "complement" : "similar";

  const db = await getDb();
  const [all, ratings] = await Promise.all([db.select().from(students), getRatings()]);
  const me = all.find((s) => s.id === sid);
  if (!me) redirect(to("/join"));
  if (!me.courses.includes(course)) redirect(to("/me"));

  let pool = recommend(me, all, course, ratings);
  if (mode === "complement") {
    // 互补模式：候选人换成有共同时间的人，分数用互补分（有缓存就用缓存）
    const [cached] = await db
      .select()
      .from(complements)
      .where(and(eq(complements.studentId, me.id), eq(complements.course, course)));
    const scoreOf = new Map(cached?.picks.map((p) => [p.id, p.score]));
    pool = complementPool(me, all, course)
      .map((s) => ({ ...(pool.find((p) => p.student.id === s.id) ?? { student: s, sharedSlots: [], reasons: [] }), score: scoreOf.get(s.id) ?? 50 }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
  }
  if (pool.length === 0) redirect(to("/me"));

  const want = me.groupSize - 1;
  const ai = await planGroup(course, me, pool, mode, ratings, t.geminiLanguage);

  let members: Student[] | null = null;
  if (ai) {
    const picked = [...new Set(ai.memberIds)]
      .map((id) => pool.find((p) => p.student.id === id)?.student)
      .filter((s): s is Student => !!s)
      .slice(0, want);
    const candidate = [me, ...picked];
    // 只接受有共同空闲时间的 AI 方案，否则回退到规则组队
    if (picked.length > 0 && commonSlots(candidate).length > 0) members = candidate;
  }
  const byAi = members !== null;
  members ??= greedyGroup(
    me,
    pool.map((p) => p.student),
    me.groupSize,
  );

  // 组名、理由和计划用发起人当时的语言生成并保存
  const meetingSlots = commonSlots(members);
  const id = crypto.randomUUID();
  await db.insert(groups).values({
    id,
    course,
    name: (byAi && ai?.groupName) || t.defaults.groupName(course),
    memberIds: members.map((m) => m.id),
    meetingSlots,
    reason: (byAi && ai?.reason) || t.defaults.groupReason(slotList(t, meetingSlots.slice(0, 3))),
    plan:
      byAi && ai?.plan.length
        ? ai.plan.slice(0, 6)
        : t.defaults.plan(course, slotList(t, meetingSlots.slice(0, 2)) || t.defaults.anytime),
    byAi,
    createdAt: new Date(),
  });
  redirect(to(`/groups/${id}`));
}

/** 互补匹配：请 Gemini 评估并缓存结果 */
export async function findComplements(formData: FormData) {
  const { locale, t } = await getActionI18n();
  const to = (path: string) => localePath(locale, path);
  const sid = await currentStudentId();
  if (!sid) redirect(to("/login"));
  const course = String(formData.get("course") ?? "");

  const db = await getDb();
  const all = await db.select().from(students);
  const me = all.find((s) => s.id === sid);
  if (!me) redirect(to("/join"));
  if (!me.courses.includes(course)) redirect(to("/me?mode=complement"));

  const pool = complementPool(me, all, course);
  const aiPicks = pool.length > 0 ? await rankComplements(course, me, pool, t.geminiLanguage) : null;
  const picks = (aiPicks ?? ruleComplements(me, pool, t)).sort((a, b) => b.score - a.score);

  await db
    .insert(complements)
    .values({ studentId: me.id, course, picks, byAi: aiPicks !== null, createdAt: new Date() })
    .onConflictDoUpdate({
      target: [complements.studentId, complements.course],
      set: { picks, byAi: aiPicks !== null, createdAt: new Date() },
    });
  redirect(to("/me?mode=complement"));
}
