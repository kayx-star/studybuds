"use server";

import { and, eq } from "drizzle-orm";
// 注意：正式（production）模式下 refresh() 不会让页面重新渲染，统一用 revalidatePath
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { requireMember } from "@/db/queries";
import { quizAttempts, quizzes, reviews, studySessions } from "@/db/schema";
import { localePath } from "@/i18n/config";
import { getActionI18n } from "@/i18n/server";
import type { Dict } from "@/i18n/zh";
import { DIFFICULTIES } from "@/lib/constants";
import { generateQuiz } from "@/lib/gemini";
import { ensureTranslations } from "@/lib/translate";

/** link：仅开发模式下展示重设密码链接时使用 */
export type FormState = { error?: string; ok?: string; link?: string };

// ---------- 约自习 ----------

const sessionSchema = (e: Dict["sessions"]["errors"]) =>
  z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, e.date),
    start: z.string().regex(/^\d{2}:\d{2}$/, e.start),
    minutes: z.coerce.number().int().min(30).max(480),
    place: z.string().trim().min(1, e.place).max(100),
    topic: z.string().trim().max(100).default(""),
  });

function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function createSession(_prev: FormState, formData: FormData): Promise<FormState> {
  const { t } = await getActionI18n();
  const ctx = await requireMember(String(formData.get("groupId")));
  if (!ctx) return { error: t.errors.notMember };
  const parsed = sessionSchema(t.sessions.errors).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (parsed.data.date < localToday()) return { error: t.sessions.errors.past };

  await ctx.db.insert(studySessions).values({
    ...parsed.data,
    id: crypto.randomUUID(),
    groupId: ctx.group.id,
    createdBy: ctx.me.id,
    attendees: [ctx.me.id],
    createdAt: new Date(),
  });
  after(() => ensureTranslations([parsed.data.place, parsed.data.topic]));
  revalidatePath("/[lang]/groups/[id]", "page");
  return { ok: t.sessions.created };
}

async function loadSession(formData: FormData) {
  const sessionId = String(formData.get("sessionId"));
  const groupId = String(formData.get("groupId"));
  const ctx = await requireMember(groupId);
  if (!ctx) return null;
  const [session] = await ctx.db
    .select()
    .from(studySessions)
    .where(and(eq(studySessions.id, sessionId), eq(studySessions.groupId, groupId)));
  return session ? { ...ctx, session } : null;
}

export async function toggleAttend(formData: FormData) {
  const ctx = await loadSession(formData);
  if (!ctx) return;
  const { db, session, me } = ctx;
  const attendees = session.attendees.includes(me.id)
    ? session.attendees.filter((id) => id !== me.id)
    : [...session.attendees, me.id];
  await db.update(studySessions).set({ attendees }).where(eq(studySessions.id, session.id));
  revalidatePath("/[lang]/groups/[id]", "page");
}

export async function cancelSession(formData: FormData) {
  const ctx = await loadSession(formData);
  if (!ctx || ctx.session.createdBy !== ctx.me.id) return;
  await ctx.db.delete(studySessions).where(eq(studySessions.id, ctx.session.id));
  revalidatePath("/[lang]/groups/[id]", "page");
}

// ---------- AI 出题比拼 ----------

const quizSchema = (e: Dict["quiz"]["errors"]) =>
  z.object({
    topic: z.string().trim().min(2, e.topic).max(100),
    notes: z.string().max(6000, e.notesLong).default(""),
    count: z.coerce.number().int().min(3).max(10),
    difficulty: z.enum(DIFFICULTIES.map((d) => d.key) as [string, ...string[]]),
  });

export async function createQuiz(_prev: FormState, formData: FormData): Promise<FormState> {
  const { locale, t } = await getActionI18n();
  const ctx = await requireMember(String(formData.get("groupId")));
  if (!ctx) return { error: t.errors.notMember };
  const parsed = quizSchema(t.quiz.errors).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { topic, notes, count, difficulty } = parsed.data;

  const questions = await generateQuiz(ctx.group.course, topic, notes, count, difficulty, t.geminiLanguage);
  if (!questions) return { error: t.quiz.errors.failed };

  const id = crypto.randomUUID();
  await ctx.db.insert(quizzes).values({
    id,
    groupId: ctx.group.id,
    topic,
    difficulty,
    questions,
    createdBy: ctx.me.id,
    createdAt: new Date(),
  });
  after(() =>
    ensureTranslations([
      topic,
      ...questions.flatMap((q) => [q.question, q.explanation, q.concept, ...q.options, ...(q.optionNotes ?? [])]),
    ]),
  );
  redirect(localePath(locale, `/quizzes/${id}`));
}

export async function submitQuiz(formData: FormData) {
  const { locale } = await getActionI18n();
  const quizId = String(formData.get("quizId"));
  const ctx = await requireMember(String(formData.get("groupId")));
  if (!ctx) redirect(localePath(locale, "/me"));
  const [quiz] = await ctx.db
    .select()
    .from(quizzes)
    .where(and(eq(quizzes.id, quizId), eq(quizzes.groupId, ctx.group.id)));
  if (!quiz) redirect(localePath(locale, "/me"));

  const answers = quiz.questions.map((_, i) => {
    const v = Number(formData.get(`q${i}`));
    return Number.isInteger(v) && v >= 0 && v < 4 ? v : -1;
  });
  const score = quiz.questions.filter((q, i) => q.answer === answers[i]).length;

  // 每人只能作答一次：已作答时保留第一次成绩
  await ctx.db
    .insert(quizAttempts)
    .values({ quizId, studentId: ctx.me.id, answers, score, createdAt: new Date() })
    .onConflictDoNothing();
  redirect(localePath(locale, `/quizzes/${quizId}`));
}

// ---------- 搭子互评 ----------

const reviewSchema = (e: Dict["reviews"]["errors"]) => {
  const star = z.coerce.number({ error: e.stars }).int().min(1, e.stars).max(5);
  return z.object({
    revieweeId: z.string().min(1),
    reliability: star,
    contribution: star,
    communication: star,
    comment: z.string().trim().max(200, e.commentLong).default(""),
  });
};

export async function saveReview(_prev: FormState, formData: FormData): Promise<FormState> {
  const { t } = await getActionI18n();
  const ctx = await requireMember(String(formData.get("groupId")));
  if (!ctx) return { error: t.errors.notMember };
  const parsed = reviewSchema(t.reviews.errors).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;
  if (data.revieweeId === ctx.me.id || !ctx.group.memberIds.includes(data.revieweeId)) {
    return { error: t.reviews.errors.notMember };
  }

  const values = {
    reliability: data.reliability,
    contribution: data.contribution,
    communication: data.communication,
    comment: data.comment,
    // 没勾选的复选框不会出现在表单里
    anonymous: formData.get("anonymous") === "on",
    createdAt: new Date(),
  };
  await ctx.db
    .insert(reviews)
    .values({ ...values, groupId: ctx.group.id, reviewerId: ctx.me.id, revieweeId: data.revieweeId })
    .onConflictDoUpdate({ target: [reviews.groupId, reviews.reviewerId, reviews.revieweeId], set: values });
  revalidatePath("/[lang]/groups/[id]", "page");
  return { ok: t.reviews.saved };
}
