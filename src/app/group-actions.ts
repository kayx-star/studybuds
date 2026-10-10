"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireMember } from "@/db/queries";
import { quizAttempts, quizzes, reviews, studySessions } from "@/db/schema";
import { DIFFICULTIES } from "@/lib/constants";
import { generateQuiz } from "@/lib/gemini";

export type FormState = { error?: string; ok?: string };

const NOT_MEMBER: FormState = { error: "只有小组成员可以操作" };

// ---------- 约自习 ----------

const SessionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "请选择日期"),
  start: z.string().regex(/^\d{2}:\d{2}$/, "请选择开始时间"),
  minutes: z.coerce.number().int().min(30).max(480),
  place: z.string().trim().min(1, "请填写地点或线上会议链接").max(100),
  topic: z.string().trim().max(100).default(""),
});

function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function createSession(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requireMember(String(formData.get("groupId")));
  if (!ctx) return NOT_MEMBER;
  const parsed = SessionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (parsed.data.date < localToday()) return { error: "不能约过去的日期" };

  await ctx.db.insert(studySessions).values({
    ...parsed.data,
    id: crypto.randomUUID(),
    groupId: ctx.group.id,
    createdBy: ctx.me.id,
    attendees: [ctx.me.id],
    createdAt: new Date(),
  });
  refresh();
  return { ok: "已发起，组员可以在下方报名" };
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
  refresh();
}

export async function cancelSession(formData: FormData) {
  const ctx = await loadSession(formData);
  if (!ctx || ctx.session.createdBy !== ctx.me.id) return;
  await ctx.db.delete(studySessions).where(eq(studySessions.id, ctx.session.id));
  refresh();
}

// ---------- AI 出题比拼 ----------

const QuizSchema = z.object({
  topic: z.string().trim().min(2, "请填写章节或知识点").max(100),
  notes: z.string().max(6000, "笔记最多 6000 字").default(""),
  count: z.coerce.number().int().min(3).max(10),
  difficulty: z.enum(DIFFICULTIES.map((d) => d.key) as [string, ...string[]]),
});

export async function createQuiz(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requireMember(String(formData.get("groupId")));
  if (!ctx) return NOT_MEMBER;
  const parsed = QuizSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { topic, notes, count, difficulty } = parsed.data;

  const questions = await generateQuiz(ctx.group.course, topic, notes, count, difficulty);
  if (!questions) return { error: "Gemini 出题失败，请稍后再试（需要配置 GEMINI_API_KEY）" };

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
  redirect(`/quizzes/${id}`);
}

export async function submitQuiz(formData: FormData) {
  const quizId = String(formData.get("quizId"));
  const ctx = await requireMember(String(formData.get("groupId")));
  if (!ctx) redirect("/me");
  const [quiz] = await ctx.db
    .select()
    .from(quizzes)
    .where(and(eq(quizzes.id, quizId), eq(quizzes.groupId, ctx.group.id)));
  if (!quiz) redirect("/me");

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
  redirect(`/quizzes/${quizId}`);
}

// ---------- 搭子互评 ----------

const star = z.coerce.number({ error: "请给每一项打分" }).int().min(1, "请给每一项打分").max(5);
const ReviewSchema = z.object({
  revieweeId: z.string().min(1),
  reliability: star,
  contribution: star,
  communication: star,
  comment: z.string().trim().max(200, "评语最多 200 字").default(""),
});

export async function saveReview(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requireMember(String(formData.get("groupId")));
  if (!ctx) return NOT_MEMBER;
  const parsed = ReviewSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;
  if (data.revieweeId === ctx.me.id || !ctx.group.memberIds.includes(data.revieweeId)) {
    return { error: "只能评价同组的其他成员" };
  }

  const values = {
    reliability: data.reliability,
    contribution: data.contribution,
    communication: data.communication,
    comment: data.comment,
    createdAt: new Date(),
  };
  await ctx.db
    .insert(reviews)
    .values({ ...values, groupId: ctx.group.id, reviewerId: ctx.me.id, revieweeId: data.revieweeId })
    .onConflictDoUpdate({ target: [reviews.groupId, reviews.reviewerId, reviews.revieweeId], set: values });
  refresh();
  return { ok: "已保存，感谢你的评价" };
}
