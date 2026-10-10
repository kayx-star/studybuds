"use server";

import { and, eq, inArray } from "drizzle-orm";
// 注意：正式（production）模式下 refresh() 不会让页面重新渲染，统一用 revalidatePath
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { getRatings, requireMember } from "@/db/queries";
import {
  codeFiles,
  complements,
  groups,
  invites,
  quizAttempts,
  quizzes,
  reviews,
  studySessions,
  students,
  type PlanStep,
  type Student,
} from "@/db/schema";
import { localePath } from "@/i18n/config";
import { slotList } from "@/i18n/format";
import { getActionI18n } from "@/i18n/server";
import type { Dict } from "@/i18n/zh";
import {
  ALL_SLOTS,
  CAMPUSES,
  GENDERS,
  GENDER_PREFS,
  GOALS,
  MODES,
  PACES,
  PERSONALITIES,
  PERSONALITY_PREFS,
  STYLE_TAGS,
  normalizeCourse,
} from "@/lib/constants";
import { analyzeBio, planGroup, rankComplements } from "@/lib/gemini";
import type { FormState } from "@/app/group-actions";
import {
  commonSlots,
  compatible,
  complementPool,
  greedyGroup,
  recommend,
  ruleComplements,
  type MatchMode,
} from "@/lib/match";
import { currentStudentId } from "@/lib/session";
import { ensureTranslations, getTranslator } from "@/lib/translate";

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
    gender: z.enum(keys(GENDERS), { message: e.gender }),
    genderPref: z.enum(keys(GENDER_PREFS)).catch("any"),
    campus: z.enum(keys(CAMPUSES)).or(z.literal("")).catch(""),
    campusPref: z.array(z.enum(keys(CAMPUSES))),
    personality: z.enum(keys(PERSONALITIES)).or(z.literal("")).catch(""),
    personalityPref: z.enum(keys(PERSONALITY_PREFS)).catch("any"),
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
    gender: formData.get("gender"),
    genderPref: formData.get("genderPref"),
    campus: formData.get("campus") ?? "",
    campusPref: formData.getAll("campusPref"),
    personality: formData.get("personality") ?? "",
    personalityPref: formData.get("personalityPref"),
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
  // 后台预先翻译成三种语言，别人用其他语言浏览时无需等待
  after(() => ensureTranslations([...data.courses, aiSummary, data.strong, data.weak]));
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
    // 只接受彼此偏好兼容、且有共同空闲时间的 AI 方案，否则回退到规则组队
    const pairwiseOk = candidate.every((a, i) => candidate.slice(i + 1).every((b) => compatible(a, b)));
    if (picked.length > 0 && pairwiseOk && commonSlots(candidate).length > 0) members = candidate;
  }
  const byAi = members !== null;
  members ??= greedyGroup(
    me,
    pool.map((p) => p.student),
    me.groupSize,
  );

  // 小组先只有发起人自己，其余人收到邀请，接受后才加入
  const id = await createGroupWithInvites(me, course, members.slice(1), t, {
    name: byAi ? ai?.groupName : undefined,
    reason: byAi ? ai?.reason : undefined,
    plan: byAi ? ai?.plan : undefined,
    byAi,
  });
  redirect(to(`/groups/${id}`));
}

/** 建组并给其他人发邀请；组名、理由和计划用发起人当时的语言生成并保存 */
async function createGroupWithInvites(
  me: Student,
  course: string,
  invitees: Student[],
  t: Dict,
  ai: { name?: string; reason?: string; plan?: PlanStep[]; byAi: boolean },
) {
  const db = await getDb();
  const expectedSlots = commonSlots([me, ...invitees]);
  // 默认文案里嵌入的课程名先换成当前语言，避免一句话里夹两种语言
  const { locale } = await getActionI18n();
  const courseName = (await getTranslator([course], locale))(course);
  const id = crypto.randomUUID();
  await db.insert(groups).values({
    id,
    course,
    name: ai.name || t.defaults.groupName(courseName),
    memberIds: [me.id],
    meetingSlots: expectedSlots,
    reason: ai.reason || t.defaults.groupReason(slotList(t, expectedSlots.slice(0, 3))),
    plan: ai.plan?.length
      ? ai.plan.slice(0, 6)
      : t.defaults.plan(courseName, slotList(t, expectedSlots.slice(0, 2)) || t.defaults.anytime),
    byAi: ai.byAi,
    createdAt: new Date(),
  });
  await sendInvites(id, me.id, invitees.map((s) => s.id));
  const [saved] = await db.select().from(groups).where(eq(groups.id, id));
  after(() => ensureTranslations([saved.course, saved.name, saved.reason, ...saved.plan.flatMap((p) => [p.title, p.detail])]));
  return id;
}

async function sendInvites(groupId: string, inviterId: string, inviteeIds: string[]) {
  if (inviteeIds.length === 0) return;
  const db = await getDb();
  await db.insert(invites).values(
    inviteeIds.map((inviteeId) => ({
      id: crypto.randomUUID(),
      groupId,
      inviterId,
      inviteeId,
      status: "pending" as const,
      createdAt: new Date(),
    })),
  );
}

/** 从推荐列表里手动勾选同学，建组并发邀请 */
export async function inviteToNewGroup(_prev: FormState, formData: FormData): Promise<FormState> {
  const { locale, t } = await getActionI18n();
  const sid = await currentStudentId();
  if (!sid) return { error: t.join.errors.sessionExpired };
  const course = String(formData.get("course") ?? "");
  const picked = [...new Set(formData.getAll("invitee").map(String))];

  const db = await getDb();
  const all = await db.select().from(students);
  const me = all.find((s) => s.id === sid);
  if (!me || !me.courses.includes(course)) return { error: t.errors.notMember };
  if (picked.length === 0) return { error: t.me.errors.noneSelected };
  if (picked.length > 5) return { error: t.me.errors.tooMany(5) };

  // 只能邀请同课、且双方偏好兼容的同学
  const invitees = all.filter((s) => picked.includes(s.id) && s.courses.includes(course) && compatible(me, s));
  if (invitees.length === 0) return { error: t.me.errors.noneSelected };

  const id = await createGroupWithInvites(me, course, invitees, t, { byAi: false });
  redirect(localePath(locale, `/groups/${id}`));
}

/** 小组成员邀请更多同学 */
export async function inviteMore(_prev: FormState, formData: FormData): Promise<FormState> {
  const { t } = await getActionI18n();
  const ctx = await requireMember(String(formData.get("groupId")));
  if (!ctx) return { error: t.errors.notMember };
  const picked = [...new Set(formData.getAll("invitee").map(String))];
  if (picked.length === 0) return { error: t.me.errors.noneSelected };
  if (picked.length > 5) return { error: t.me.errors.tooMany(5) };

  const { db, group, me } = ctx;
  const [all, existing] = await Promise.all([
    db.select().from(students),
    db.select().from(invites).where(and(eq(invites.groupId, group.id), eq(invites.status, "pending"))),
  ]);
  const members = all.filter((s) => group.memberIds.includes(s.id));
  const invitees = all.filter(
    (s) =>
      picked.includes(s.id) &&
      s.courses.includes(group.course) &&
      !group.memberIds.includes(s.id) &&
      !existing.some((i) => i.inviteeId === s.id) &&
      members.every((m) => compatible(m, s)),
  );
  await sendInvites(group.id, me.id, invitees.map((s) => s.id));
  revalidatePath("/[lang]/groups/[id]", "page");
  return { ok: t.group.invitesSent };
}

/** 接受或婉拒邀请 */
export async function respondInvite(formData: FormData) {
  const { locale } = await getActionI18n();
  const sid = await currentStudentId();
  if (!sid) redirect(localePath(locale, "/login"));
  const inviteId = String(formData.get("inviteId"));
  const accept = formData.get("decision") === "accept";

  const db = await getDb();
  const [invite] = await db
    .select()
    .from(invites)
    .where(and(eq(invites.id, inviteId), eq(invites.inviteeId, sid), eq(invites.status, "pending")));
  if (!invite) redirect(localePath(locale, "/me"));

  await db.update(invites).set({ status: accept ? "accepted" : "declined" }).where(eq(invites.id, invite.id));
  if (!accept) {
    revalidatePath("/[lang]/me", "page");
    revalidatePath("/[lang]/groups/[id]", "page");
    return;
  }

  const [group] = await db.select().from(groups).where(eq(groups.id, invite.groupId));
  if (group && !group.memberIds.includes(sid)) {
    const memberIds = [...group.memberIds, sid];
    const members = await db.select().from(students).where(inArray(students.id, memberIds));
    await db.update(groups).set({ memberIds, meetingSlots: commonSlots(members) }).where(eq(groups.id, group.id));
  }
  redirect(localePath(locale, `/groups/${invite.groupId}`));
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
  after(() => ensureTranslations(picks.map((p) => p.reason)));
  redirect(to("/me?mode=complement"));
}

/** 退出小组：最后一人退出时连同小组数据一起删除 */
export async function leaveGroup(formData: FormData) {
  const { locale } = await getActionI18n();
  const ctx = await requireMember(String(formData.get("groupId")));
  if (!ctx) redirect(localePath(locale, "/me"));
  const { db, group, me } = ctx;
  const remaining = group.memberIds.filter((id) => id !== me.id);

  if (remaining.length === 0) {
    const quizIds = (await db.select({ id: quizzes.id }).from(quizzes).where(eq(quizzes.groupId, group.id))).map((q) => q.id);
    if (quizIds.length > 0) await db.delete(quizAttempts).where(inArray(quizAttempts.quizId, quizIds));
    await db.delete(quizzes).where(eq(quizzes.groupId, group.id));
    await db.delete(studySessions).where(eq(studySessions.groupId, group.id));
    await db.delete(codeFiles).where(eq(codeFiles.groupId, group.id));
    await db.delete(reviews).where(eq(reviews.groupId, group.id));
    await db.delete(invites).where(eq(invites.groupId, group.id));
    await db.delete(groups).where(eq(groups.id, group.id));
  } else {
    const members = await db.select().from(students).where(inArray(students.id, remaining));
    await db.update(groups).set({ memberIds: remaining, meetingSlots: commonSlots(members) }).where(eq(groups.id, group.id));
    // 取消自己在这个小组自习里的报名
    const sessions = await db.select().from(studySessions).where(eq(studySessions.groupId, group.id));
    for (const s of sessions.filter((x) => x.attendees.includes(me.id))) {
      await db
        .update(studySessions)
        .set({ attendees: s.attendees.filter((id) => id !== me.id) })
        .where(eq(studySessions.id, s.id));
    }
  }
  redirect(localePath(locale, "/me"));
}
