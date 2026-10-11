"use server";

import { and, eq } from "drizzle-orm";
// Note: in production, refresh() does not re-render the page, so we use revalidatePath everywhere
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { requireMember } from "@/db/queries";
import { quizAttempts, quizzes, reviews, studySessions } from "@/db/schema";
import { localePath } from "@/i18n/config";
import { getActionI18n } from "@/i18n/server";
import type { Dict } from "@/i18n/zh";
import { DIFFICULTIES } from "@/lib/constants";
import { generateQuiz } from "@/lib/gemini";
import { quizState } from "@/lib/quiz-state";
import { ensureTranslations } from "@/lib/translate";

/** link: only used to show the password-reset link in development */
export type FormState = { error?: string; ok?: string; link?: string };

// ---------- Study sessions ----------

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

// ---------- AI quizzes ----------

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

  // Save the quiz right away and let Gemini write the questions in the background;
  // the quiz page shows "generating" and refreshes itself until they are ready.
  const id = crypto.randomUUID();
  await ctx.db.insert(quizzes).values({
    id,
    groupId: ctx.group.id,
    topic,
    difficulty,
    questions: [],
    status: "generating",
    request: { notes, count },
    createdBy: ctx.me.id,
    createdAt: new Date(),
  });
  after(() => generateQuizQuestions(id, ctx.group.course, t.geminiLanguage));
  redirect(localePath(locale, `/quizzes/${id}`));
}

/** Background job: asks Gemini for the questions and stores the result or the failure reason */
async function generateQuizQuestions(quizId: string, course: string, language: string) {
  const db = await getDb();
  const [quiz] = await db.select().from(quizzes).where(eq(quizzes.id, quizId));
  if (!quiz) return;
  const { notes, count } = quiz.request;
  const result = await generateQuiz(course, quiz.topic, notes, count, quiz.difficulty, language).catch((err) => {
    console.error("[quiz] generation crashed:", err);
    return { ok: false as const, reason: "failed" as const };
  });
  if (!result.ok) {
    await db.update(quizzes).set({ status: "failed", error: result.reason }).where(eq(quizzes.id, quizId));
    return;
  }
  const questions = result.data;
  await db.update(quizzes).set({ status: "ready", error: "", questions }).where(eq(quizzes.id, quizId));
  await ensureTranslations([
    quiz.topic,
    ...questions.flatMap((q) => [q.question, q.explanation, q.concept, ...q.options, ...(q.optionNotes ?? [])]),
  ]);
}

async function loadQuiz(formData: FormData) {
  const quizId = String(formData.get("quizId"));
  const groupId = String(formData.get("groupId"));
  const ctx = await requireMember(groupId);
  if (!ctx) return null;
  const [quiz] = await ctx.db
    .select()
    .from(quizzes)
    .where(and(eq(quizzes.id, quizId), eq(quizzes.groupId, groupId)));
  return quiz ? { ...ctx, quiz } : null;
}

/** Any member can retry a quiz whose generation failed */
export async function retryQuiz(formData: FormData) {
  const { t } = await getActionI18n();
  const ctx = await loadQuiz(formData);
  if (!ctx || quizState(ctx.quiz) !== "failed") return;
  await ctx.db
    .update(quizzes)
    .set({ status: "generating", error: "", createdAt: new Date() })
    .where(eq(quizzes.id, ctx.quiz.id));
  after(() => generateQuizQuestions(ctx.quiz.id, ctx.group.course, t.geminiLanguage));
  revalidatePath("/[lang]/quizzes/[id]", "page");
}

/** The author can remove a quiz that failed to generate */
export async function deleteQuiz(formData: FormData) {
  const { locale } = await getActionI18n();
  const ctx = await loadQuiz(formData);
  if (!ctx || ctx.quiz.createdBy !== ctx.me.id || quizState(ctx.quiz) !== "failed") return;
  await ctx.db.delete(quizzes).where(eq(quizzes.id, ctx.quiz.id));
  revalidatePath("/[lang]/groups/[id]", "page");
  redirect(localePath(locale, `/groups/${ctx.group.id}`));
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
  if (quiz.status !== "ready") redirect(localePath(locale, `/quizzes/${quizId}`));

  const answers = quiz.questions.map((_, i) => {
    const v = Number(formData.get(`q${i}`));
    return Number.isInteger(v) && v >= 0 && v < 4 ? v : -1;
  });
  const score = quiz.questions.filter((q, i) => q.answer === answers[i]).length;

  // One attempt per person: keep the first score if already answered
  await ctx.db
    .insert(quizAttempts)
    .values({ quizId, studentId: ctx.me.id, answers, score, createdAt: new Date() })
    .onConflictDoNothing();
  redirect(localePath(locale, `/quizzes/${quizId}`));
}

// ---------- Peer reviews ----------

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
    // Unchecked checkboxes are not included in the form data
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
