"use server";

import { and, eq, inArray } from "drizzle-orm";
// Note: in production, refresh() does not re-render the page, so we use revalidatePath everywhere
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
import { isValidClass } from "@/lib/courses";
import { isSubjectCode, subjectLabel } from "@/lib/subjects";
import { ensureTranslations } from "@/lib/translate";

const keys = <T extends readonly { key: string }[]>(list: T) =>
  list.map((x) => x.key) as [T[number]["key"], ...T[number]["key"][]];

const profileSchema = (e: Dict["join"]["errors"]) =>
  z.object({
    name: z.string().trim().min(1, e.name).max(20, e.nameLong),
    contact: z.string().trim().min(1, e.contact).max(50),
    // Only accept codes from the subject list (e.g. "198"), deduplicated; subjects of chosen courses are added automatically
    courses: z.array(z.string()),
    classes: z
      .array(z.string())
      .transform((list) => [...new Set(list.filter(isValidClass))])
      .pipe(z.array(z.string()).max(10, e.classesMany)),
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
    courses: formData.getAll("courses").map(String),
    classes: formData.getAll("classes").map(String),
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
  const subjects = [
    ...new Set([...parsed.data.courses, ...parsed.data.classes.map((c) => c.slice(0, 3))].filter(isSubjectCode)),
  ];
  if (subjects.length === 0) return { error: t.join.errors.courses };
  if (subjects.length > 8) return { error: t.join.errors.coursesMany };
  const data = { ...parsed.data, courses: subjects };

  const sid = await currentStudentId();
  if (!sid) return { error: t.join.errors.sessionExpired };
  const db = await getDb();
  const [existing] = await db.select().from(students).where(eq(students.id, sid));

  // Only ask Gemini to re-analyze when the bio changed
  let aiSummary = existing?.aiSummary ?? null;
  let tags: string[] = data.tags;
  if (data.bio !== existing?.bio) {
    const analysis = await analyzeBio(data.bio, t.geminiLanguage);
    aiSummary = analysis?.summary ?? null;
    if (analysis) tags = [...new Set([...tags, ...analysis.tags])];
  }

  if (existing) {
    await db.update(students).set({ ...data, tags, aiSummary }).where(eq(students.id, existing.id));
    // Strengths/weaknesses or subjects changed, so cached complementary matches are stale
    if (data.strong !== existing.strong || data.weak !== existing.weak || data.courses.join() !== existing.courses.join()) {
      await db.delete(complements).where(eq(complements.studentId, existing.id));
    }
  } else {
    // The profile id is the same as the account id
    await db.insert(students).values({ ...data, tags, aiSummary, id: sid, createdAt: new Date() });
  }
  // Pre-translate into all three languages in the background so other viewers don't wait
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
    // Complementary mode: candidates are people with shared free time, scored by complementarity (cached if available)
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
    // Only accept the AI's pick if everyone's preferences are compatible and they share free time; otherwise fall back to rule-based grouping
    const pairwiseOk = candidate.every((a, i) => candidate.slice(i + 1).every((b) => compatible(a, b)));
    if (picked.length > 0 && pairwiseOk && commonSlots(candidate).length > 0) members = candidate;
  }
  const byAi = members !== null;
  members ??= greedyGroup(
    me,
    pool.map((p) => p.student),
    me.groupSize,
  );

  // The group starts with just the requester; everyone else gets an invite and joins after accepting
  const id = await createGroupWithInvites(me, course, members.slice(1), t, {
    name: byAi ? ai?.groupName : undefined,
    reason: byAi ? ai?.reason : undefined,
    plan: byAi ? ai?.plan : undefined,
    byAi,
  });
  redirect(to(`/groups/${id}`));
}

/** Creates a group and invites the others; name, reason and plan are generated in the requester's language */
async function createGroupWithInvites(
  me: Student,
  course: string,
  invitees: Student[],
  t: Dict,
  ai: { name?: string; reason?: string; plan?: PlanStep[]; byAi: boolean },
) {
  const db = await getDb();
  const expectedSlots = commonSlots([me, ...invitees]);
  // Put the subject name in the current language first so default text doesn't mix languages
  const { locale } = await getActionI18n();
  const courseName = subjectLabel(course, locale);
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

/** Creates a group from classmates ticked in the match list and invites them */
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

  // Only classmates in the same subject with compatible preferences can be invited
  const invitees = all.filter((s) => picked.includes(s.id) && s.courses.includes(course) && compatible(me, s));
  if (invitees.length === 0) return { error: t.me.errors.noneSelected };

  const id = await createGroupWithInvites(me, course, invitees, t, { byAi: false });
  redirect(localePath(locale, `/groups/${id}`));
}

/** Lets group members invite more classmates */
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

/** Accepts or declines an invite */
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

/** Complementary matching: asks Gemini to score candidates and caches the result */
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

/** Leaves a group; when the last member leaves, the group and its data are deleted */
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
    // Remove myself from this group's study-session RSVPs
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
