"use server";

import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { getRatings } from "@/db/queries";
import { complements, groups, students, type PlanStep, type Student } from "@/db/schema";
import { ALL_SLOTS, GOALS, MODES, PACES, STYLE_TAGS, normalizeCourse, slotLabel } from "@/lib/constants";
import { analyzeBio, planGroup, rankComplements } from "@/lib/gemini";
import { commonSlots, complementPool, greedyGroup, recommend, ruleComplements, type MatchMode } from "@/lib/match";
import { SID, currentStudentId } from "@/lib/session";

const keys = <T extends readonly { key: string }[]>(list: T) =>
  list.map((x) => x.key) as [T[number]["key"], ...T[number]["key"][]];

const ProfileSchema = z.object({
  name: z.string().trim().min(1, "请填写昵称").max(20, "昵称最多 20 字"),
  contact: z.string().trim().min(1, "请填写联系方式（组队成功后仅组员可见）").max(50),
  courses: z
    .string()
    .transform((s) => [...new Set(s.split(/[,，、;；\n]/).map(normalizeCourse).filter(Boolean))])
    .pipe(z.array(z.string().max(30)).min(1, "至少填写一门课程").max(8, "最多 8 门课程")),
  slots: z.array(z.enum(ALL_SLOTS)).min(1, "至少选择一个空闲时段"),
  pace: z.enum(keys(PACES), { message: "请选择学习节奏" }),
  mode: z.enum(keys(MODES), { message: "请选择学习方式" }),
  goal: z.enum(keys(GOALS), { message: "请选择学习目标" }),
  tags: z.array(z.enum(STYLE_TAGS)),
  groupSize: z.coerce.number().int().min(2).max(6),
  bio: z.string().trim().max(500, "自我介绍最多 500 字"),
  strong: z.string().trim().max(200, "“我擅长”最多 200 字"),
  weak: z.string().trim().max(200, "“我想补强”最多 200 字"),
});

export type JoinState = { error?: string };

export async function saveProfile(_prev: JoinState, formData: FormData): Promise<JoinState> {
  const parsed = ProfileSchema.safeParse({
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

  const db = await getDb();
  const sid = await currentStudentId();
  const [existing] = sid ? await db.select().from(students).where(eq(students.id, sid)) : [];

  // 自我介绍变了才重新请 Gemini 分析
  let aiSummary = existing?.aiSummary ?? null;
  let tags: string[] = data.tags;
  if (data.bio !== existing?.bio) {
    const analysis = await analyzeBio(data.bio);
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
    const id = crypto.randomUUID();
    await db.insert(students).values({ ...data, tags, aiSummary, id, createdAt: new Date() });
    (await cookies()).set(SID, id, { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  }
  redirect("/me");
}

function defaultPlan(course: string, slots: string[]): PlanStep[] {
  const when = slots.slice(0, 2).map(slotLabel).join("、") || "大家约定的时间";
  return [
    { title: "固定学习时间", detail: `每周 ${when} 一起学习 ${course}，每次 1.5–2 小时。` },
    { title: "轮流主讲", detail: "每次由一位同学负责梳理本周知识点，其他人提问补充。" },
    { title: "练习与互查", detail: "每周各自完成习题，见面时互相讲解错题。" },
    { title: "考前冲刺", detail: "考前两周改为每周两次，集中做往年题和模拟题。" },
  ];
}

export async function formGroup(formData: FormData) {
  const sid = await currentStudentId();
  if (!sid) redirect("/join");
  const course = String(formData.get("course") ?? "");
  const mode: MatchMode = formData.get("mode") === "complement" ? "complement" : "similar";

  const db = await getDb();
  const [all, ratings] = await Promise.all([db.select().from(students), getRatings()]);
  const me = all.find((s) => s.id === sid);
  if (!me) redirect("/join");
  if (!me.courses.includes(course)) redirect("/me");

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
  if (pool.length === 0) redirect("/me");

  const want = me.groupSize - 1;
  const ai = await planGroup(course, me, pool, mode, ratings);

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

  const meetingSlots = commonSlots(members);
  const id = crypto.randomUUID();
  await db.insert(groups).values({
    id,
    course,
    name: (byAi && ai?.groupName) || `${course} 学习小组`,
    memberIds: members.map((m) => m.id),
    meetingSlots,
    reason:
      (byAi && ai?.reason) ||
      `按共同空闲时间与学习风格匹配，大家都能在 ${meetingSlots.slice(0, 3).map(slotLabel).join("、")} 一起学习。`,
    plan: byAi && ai?.plan.length ? ai.plan.slice(0, 6) : defaultPlan(course, meetingSlots),
    byAi,
    createdAt: new Date(),
  });
  redirect(`/groups/${id}`);
}

/** 互补匹配：请 Gemini 评估并缓存结果 */
export async function findComplements(formData: FormData) {
  const sid = await currentStudentId();
  if (!sid) redirect("/join");
  const course = String(formData.get("course") ?? "");

  const db = await getDb();
  const all = await db.select().from(students);
  const me = all.find((s) => s.id === sid);
  if (!me) redirect("/join");
  if (!me.courses.includes(course)) redirect("/me?mode=complement");

  const pool = complementPool(me, all, course);
  const aiPicks = pool.length > 0 ? await rankComplements(course, me, pool) : null;
  const picks = (aiPicks ?? ruleComplements(me, pool)).sort((a, b) => b.score - a.score);

  await db
    .insert(complements)
    .values({ studentId: me.id, course, picks, byAi: aiPicks !== null, createdAt: new Date() })
    .onConflictDoUpdate({
      target: [complements.studentId, complements.course],
      set: { picks, byAi: aiPicks !== null, createdAt: new Date() },
    });
  redirect("/me?mode=complement");
}

export async function logout() {
  (await cookies()).delete(SID);
  redirect("/");
}
