// Generates demo students for trying out matching locally: npm run seed
import { createClient } from "@libsql/client";
import { randomBytes, scryptSync } from "node:crypto";
import { readFileSync } from "node:fs";

const client = createClient({ url: process.env.DATABASE_URL ?? "file:local.db", authToken: process.env.DATABASE_AUTH_TOKEN });
const schema = readFileSync(new URL("../src/db/schema.ts", import.meta.url), "utf8");
await client.executeMultiple(schema.match(/export const DDL = `([\s\S]*?)`;/)[1]);
for (const [, sql] of schema.matchAll(/"(ALTER TABLE [^"]+)"/g)) await client.execute(sql).catch(() => {});

// Demo nicknames: a mix of Chinese and English names, like real users
const NAMES = ["小林", "阿杰", "Momo", "晓雨", "大鹏", "Coco", "子轩", "一一", "老王", "Yuki", "思远", "安安", "Leo", "糖糖", "浩然", "七七", "阿诚", "Nina", "可乐", "北北"];
// Subject codes (see src/lib/subjects.ts): Mathematics, Computer Science, English Writing, Mechanical & Aerospace Eng., Statistics
const COURSES = ["640", "198", "355", "650", "960"];
const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const PERIODS = ["am", "pm", "eve"];
// Style tags use the same Chinese keys as STYLE_TAGS in src/lib/constants.ts
const TAGS = ["讨论交流", "安静自习", "刷题练习", "互相讲解", "笔记整理", "项目实践", "打卡监督", "考前冲刺"];
// Topics per subject (written in Chinese like real user input; the app translates them for display),
// used to generate demo "good at / wants to improve" text
const TOPICS = {
  "640": ["极限", "导数", "积分", "微分方程", "级数"],
  "198": ["循环", "函数", "递归", "指针", "链表"],
  "355": ["词汇", "写作", "论文结构", "引用格式"],
  "650": ["静力学", "动力学", "热传导", "流体力学"],
  "960": ["概率", "假设检验", "回归分析", "抽样"],
};
const GENDERS = ["male", "female", "female", "male", "nonbinary", "undisclosed"];
const CAMPUSES = ["busch", "livingston", "college-ave", "cook-douglass"];
const PERSONALITIES = ["introvert", "ambivert", "extrovert"];
const pick = (arr, n) => [...arr].sort(() => Math.random() - 0.5).slice(0, n);
const one = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

// Login password for demo students (local test data only)
const DEMO_PASSWORD = "demo1234";
const hashPassword = (pw) => {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString("base64")}$${scryptSync(pw, salt, 64).toString("base64")}`;
};

await client.execute("DELETE FROM auth_sessions WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'demo-%')");
await client.execute("DELETE FROM users WHERE email LIKE 'demo-%'");
await client.execute("DELETE FROM students WHERE contact LIKE 'demo-%'");
for (const [i, name] of NAMES.entries()) {
  const courses = pick(COURSES, rand(1, 3));
  const topics = pick(courses.flatMap((c) => TOPICS[c]), 4);
  // Bias toward evenings and weekends to make matches more realistic
  const slots = pick(DAYS.flatMap((d) => PERIODS.map((p) => `${d}-${p}`)).filter((s) => s.endsWith("eve") || s.startsWith("sat") || s.startsWith("sun") || Math.random() < 0.2), rand(3, 7));
  const id = crypto.randomUUID();
  await client.execute({
    sql: "INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)",
    args: [id, `demo-${i}@example.com`, hashPassword(DEMO_PASSWORD), Math.floor(Date.now() / 1000)],
  });
  await client.execute({
    sql: `INSERT INTO students (id, name, contact, courses, slots, pace, mode, goal, tags, group_size, bio, strong, weak,
            gender, gender_pref, campus, campus_pref, personality, personality_pref, ai_summary, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
    args: [id, name, `demo-${i}@example.com`, JSON.stringify(courses), JSON.stringify(slots),
      one(["slow", "medium", "fast"]), one(["online", "offline", "either"]), one(["pass", "good", "deep"]),
      JSON.stringify(pick(TAGS, rand(1, 3))), rand(2, 4), topics.slice(0, 2).join("、"), topics.slice(2).join("、"),
      one(GENDERS), Math.random() < 0.8 ? "any" : one(["male", "female"]), one(CAMPUSES),
      JSON.stringify(Math.random() < 0.6 ? [] : pick(CAMPUSES, rand(1, 2))), one(PERSONALITIES),
      one(["any", "any", "introvert", "extrovert"]), Math.floor(Date.now() / 1000)],
  });
}
console.log(`Generated ${NAMES.length} demo students, subjects: ${COURSES.join(", ")}`);
console.log(`Demo accounts: demo-0@example.com ~ demo-${NAMES.length - 1}@example.com, password ${DEMO_PASSWORD}`);
