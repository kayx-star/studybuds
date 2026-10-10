import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { Campus, Gender, GenderPref, Goal, Mode, Pace, Personality, PersonalityPref } from "@/lib/constants";

export const students = sqliteTable("students", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  contact: text("contact").notNull(),
  /** 科目代码，如 "198"；匹配同学的主要依据 */
  courses: text("courses", { mode: "json" }).$type<string[]>().notNull(),
  /** 选填的具体课程："198:111" 或 "198:111#11389"（带 Index 班级） */
  classes: text("classes", { mode: "json" }).$type<string[]>().notNull().default([]),
  slots: text("slots", { mode: "json" }).$type<string[]>().notNull(),
  pace: text("pace").$type<Pace>().notNull(),
  mode: text("mode").$type<Mode>().notNull(),
  goal: text("goal").$type<Goal>().notNull(),
  tags: text("tags", { mode: "json" }).$type<string[]>().notNull(),
  groupSize: integer("group_size").notNull(),
  bio: text("bio").notNull().default(""),
  strong: text("strong").notNull().default(""),
  weak: text("weak").notNull().default(""),
  gender: text("gender").$type<Gender>().notNull().default("undisclosed"),
  genderPref: text("gender_pref").$type<GenderPref>().notNull().default("any"),
  campus: text("campus").$type<Campus | "">().notNull().default(""),
  campusPref: text("campus_pref", { mode: "json" }).$type<Campus[]>().notNull().default([]),
  personality: text("personality").$type<Personality | "">().notNull().default(""),
  personalityPref: text("personality_pref").$type<PersonalityPref>().notNull().default("any"),
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
export type QuizQuestion = {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
  /** 考查的知识点 */
  concept?: string;
  /** 每个选项的说明：错误选项对应的常见误解（旧题目没有） */
  optionNotes?: string[];
};
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
  /** 评价人可以选择匿名（默认）或署上自己的昵称 */
  anonymous: integer("anonymous", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

/** 登录账号；students.id 与 users.id 相同（资料是账号的一部分） */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

/** 登录会话：cookie 里放随机令牌，这里只存它的 SHA-256 */
export const authSessions = sqliteTable("auth_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: text("user_id").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
});

/** 组队邀请：被邀请人接受后才加入 groups.memberIds */
export type InviteStatus = "pending" | "accepted" | "declined";
export const invites = sqliteTable("invites", {
  id: text("id").primaryKey(),
  groupId: text("group_id").notNull(),
  inviterId: text("inviter_id").notNull(),
  inviteeId: text("invitee_id").notNull(),
  status: text("status").$type<InviteStatus>().notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

/** 小组共享代码文件 */
export const codeFiles = sqliteTable("code_files", {
  id: text("id").primaryKey(),
  groupId: text("group_id").notNull(),
  name: text("name").notNull(),
  content: text("content").notNull(),
  version: integer("version").notNull(),
  updatedBy: text("updated_by").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

/** 好友关系：pending = 等待对方接受；accepted = 已是好友。拒绝或删除时直接删掉这一行 */
export const friendships = sqliteTable("friendships", {
  id: text("id").primaryKey(),
  requesterId: text("requester_id").notNull(),
  addresseeId: text("addressee_id").notNull(),
  status: text("status").$type<"pending" | "accepted">().notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
export type Friendship = typeof friendships.$inferSelect;

/** 私信：createdAt 用毫秒，保证同一秒内的消息顺序正确 */
export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  senderId: text("sender_id").notNull(),
  recipientId: text("recipient_id").notNull(),
  body: text("body").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  readAt: integer("read_at", { mode: "timestamp_ms" }),
});
export type Message = typeof messages.$inferSelect;

/** 重设密码令牌：邮件里放随机令牌，这里只存 SHA-256；一次性、30 分钟有效 */
export const passwordResets = sqliteTable("password_resets", {
  tokenHash: text("token_hash").primaryKey(),
  userId: text("user_id").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  usedAt: integer("used_at", { mode: "timestamp" }),
});

/** 用户内容 / AI 内容的翻译缓存，按原文的 SHA-256 存 */
export const translations = sqliteTable("translations", {
  hash: text("hash").primaryKey(),
  source: text("source").notNull(),
  zh: text("zh").notNull(),
  en: text("en").notNull(),
  es: text("es").notNull(),
});

export type Student = typeof students.$inferSelect;
export type Group = typeof groups.$inferSelect;
export type StudySession = typeof studySessions.$inferSelect;
export type Quiz = typeof quizzes.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type Invite = typeof invites.$inferSelect;
export type CodeFile = typeof codeFiles.$inferSelect;

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
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_sessions_user ON auth_sessions (user_id);
CREATE TABLE IF NOT EXISTS invites (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  inviter_id TEXT NOT NULL,
  invitee_id TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS invites_invitee ON invites (invitee_id, status);
CREATE INDEX IF NOT EXISTS invites_group ON invites (group_id);
CREATE TABLE IF NOT EXISTS code_files (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  version INTEGER NOT NULL,
  updated_by TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (group_id, name)
);
CREATE TABLE IF NOT EXISTS friendships (
  id TEXT PRIMARY KEY,
  requester_id TEXT NOT NULL,
  addressee_id TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (requester_id, addressee_id)
);
CREATE INDEX IF NOT EXISTS friendships_addressee ON friendships (addressee_id, status);
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  sender_id TEXT NOT NULL,
  recipient_id TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  read_at INTEGER
);
CREATE INDEX IF NOT EXISTS messages_pair ON messages (sender_id, recipient_id, created_at);
CREATE INDEX IF NOT EXISTS messages_unread ON messages (recipient_id, read_at);
CREATE TABLE IF NOT EXISTS password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER
);
CREATE TABLE IF NOT EXISTS translations (
  hash TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  zh TEXT NOT NULL,
  en TEXT NOT NULL,
  es TEXT NOT NULL
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
  "ALTER TABLE students ADD COLUMN gender TEXT NOT NULL DEFAULT 'undisclosed'",
  "ALTER TABLE students ADD COLUMN gender_pref TEXT NOT NULL DEFAULT 'any'",
  "ALTER TABLE students ADD COLUMN campus TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE students ADD COLUMN campus_pref TEXT NOT NULL DEFAULT '[]'",
  "ALTER TABLE students ADD COLUMN personality TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE students ADD COLUMN personality_pref TEXT NOT NULL DEFAULT 'any'",
  "ALTER TABLE reviews ADD COLUMN anonymous INTEGER NOT NULL DEFAULT 1",
  "ALTER TABLE students ADD COLUMN classes TEXT NOT NULL DEFAULT '[]'",
];
