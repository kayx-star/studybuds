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

export type Student = typeof students.$inferSelect;
export type Group = typeof groups.$inferSelect;

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
`;
