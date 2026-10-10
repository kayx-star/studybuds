import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { Goal, Mode, Pace } from "@/lib/constants";

export const students = sqliteTable("students", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  contact: text("contact").notNull(),
  courses: text("courses", { mode: "json" }).$type<string[]>().notNull(),
  slots: text("slots", { mode: "json" }).$type<string[]>().notNull(),
  pace: text("pace").$type<Pace>().notNull(),
  mode: text("mode").$type<Mode>().notNull(),
  goal: text("goal").$type<Goal>().notNull(),
  tags: text("tags", { mode: "json" }).$type<string[]>().notNull(),
  groupSize: integer("group_size").notNull(),
  bio: text("bio").notNull().default(""),
  strong: text("strong").notNull().default(""),
  weak: text("weak").notNull().default(""),
  aiSummary: text("ai_summary"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export type PlanStep = { title: string; detail: string };

export const groups = sqliteTable("groups", {
  id: text("id").primaryKey(),
  course: text("course").notNull(),
  name: text("name").notNull(),
  memberIds: text("member_ids", { mode: "json" }).$type<string[]>().notNull(),
  meetingSlots: text("meeting_slots", { mode: "json" }).$type<string[]>().notNull(),
  reason: text("reason").notNull(),
  plan: text("plan", { mode: "json" }).$type<PlanStep[]>().notNull(),
  byAi: integer("by_ai", { mode: "boolean" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

/** Gemini 互补匹配结果缓存，避免每次打开页面都调用 */
export type ComplementPick = { id: string; score: number; reason: string };
export const complements = sqliteTable("complements", {
  studentId: text("student_id").notNull(),
  course: text("course").notNull(),
  picks: text("picks", { mode: "json" }).$type<ComplementPick[]>().notNull(),
  byAi: integer("by_ai", { mode: "boolean" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

/** 约自习 */
export const studySessions = sqliteTable("study_sessions", {
  id: text("id").primaryKey(),
  groupId: text("group_id").notNull(),
  date: text("date").notNull(), // YYYY-MM-DD
  start: text("start").notNull(), // HH:MM
  minutes: integer("minutes").notNull(),
  place: text("place").notNull(),
  topic: text("topic").notNull(),
  createdBy: text("created_by").notNull(),
  attendees: text("attendees", { mode: "json" }).$type<string[]>().notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

/** AI 出题 */
export type QuizQuestion = { question: string; options: string[]; answer: number; explanation: string };
export const quizzes = sqliteTable("quizzes", {
  id: text("id").primaryKey(),
  groupId: text("group_id").notNull(),
  topic: text("topic").notNull(),
  difficulty: text("difficulty").notNull(),
  questions: text("questions", { mode: "json" }).$type<QuizQuestion[]>().notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const quizAttempts = sqliteTable("quiz_attempts", {
  quizId: text("quiz_id").notNull(),
  studentId: text("student_id").notNull(),
  answers: text("answers", { mode: "json" }).$type<number[]>().notNull(),
  score: integer("score").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

/** 搭子互评：每人对每位组员在每个小组里只有一条，可修改 */
export const reviews = sqliteTable("reviews", {
  groupId: text("group_id").notNull(),
  reviewerId: text("reviewer_id").notNull(),
  revieweeId: text("reviewee_id").notNull(),
  reliability: integer("reliability").notNull(),
  contribution: integer("contribution").notNull(),
  communication: integer("communication").notNull(),
  comment: text("comment").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export type Student = typeof students.$inferSelect;
export type Group = typeof groups.$inferSelect;
export type StudySession = typeof studySessions.$inferSelect;
export type Quiz = typeof quizzes.$inferSelect;
export type Review = typeof reviews.$inferSelect;

// 首次启动时自动建表，免去迁移工具
export const DDL = `
CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  contact TEXT NOT NULL,
  courses TEXT NOT NULL,
  slots TEXT NOT NULL,
  pace TEXT NOT NULL,
  mode TEXT NOT NULL,
  goal TEXT NOT NULL,
  tags TEXT NOT NULL,
  group_size INTEGER NOT NULL,
  bio TEXT NOT NULL DEFAULT '',
  ai_summary TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,
  course TEXT NOT NULL,
  name TEXT NOT NULL,
  member_ids TEXT NOT NULL,
  meeting_slots TEXT NOT NULL,
  reason TEXT NOT NULL,
  plan TEXT NOT NULL,
  by_ai INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS complements (
  student_id TEXT NOT NULL,
  course TEXT NOT NULL,
  picks TEXT NOT NULL,
  by_ai INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (student_id, course)
);
CREATE TABLE IF NOT EXISTS study_sessions (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  date TEXT NOT NULL,
  start TEXT NOT NULL,
  minutes INTEGER NOT NULL,
  place TEXT NOT NULL,
  topic TEXT NOT NULL,
  created_by TEXT NOT NULL,
  attendees TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS study_sessions_group ON study_sessions (group_id);
CREATE TABLE IF NOT EXISTS quizzes (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  questions TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS quizzes_group ON quizzes (group_id);
CREATE TABLE IF NOT EXISTS quiz_attempts (
  quiz_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  answers TEXT NOT NULL,
  score INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (quiz_id, student_id)
);
CREATE TABLE IF NOT EXISTS reviews (
  group_id TEXT NOT NULL,
  reviewer_id TEXT NOT NULL,
  reviewee_id TEXT NOT NULL,
  reliability INTEGER NOT NULL,
  contribution INTEGER NOT NULL,
  communication INTEGER NOT NULL,
  comment TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (group_id, reviewer_id, reviewee_id)
);
`;

// 给已有数据库补列；列已存在时 SQLite 会报错，忽略即可
export const MIGRATIONS = [
  "ALTER TABLE students ADD COLUMN strong TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE students ADD COLUMN weak TEXT NOT NULL DEFAULT ''",
];
