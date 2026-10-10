// 生成示例同学，方便本地体验匹配：npm run seed
import { createClient } from "@libsql/client";
import { randomBytes, scryptSync } from "node:crypto";
import { readFileSync } from "node:fs";

const client = createClient({ url: process.env.DATABASE_URL ?? "file:local.db", authToken: process.env.DATABASE_AUTH_TOKEN });
const schema = readFileSync(new URL("../src/db/schema.ts", import.meta.url), "utf8");
await client.executeMultiple(schema.match(/export const DDL = `([\s\S]*?)`;/)[1]);
for (const [, sql] of schema.matchAll(/"(ALTER TABLE [^"]+)"/g)) await client.execute(sql).catch(() => {});

const NAMES = ["小林", "阿杰", "Momo", "晓雨", "大鹏", "Coco", "子轩", "一一", "老王", "Yuki", "思远", "安安", "Leo", "糖糖", "浩然", "七七", "阿诚", "Nina", "可乐", "北北"];
const COURSES = ["高等数学", "CS101", "大学英语", "线性代数", "数据结构"];
const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const PERIODS = ["am", "pm", "eve"];
const TAGS = ["讨论交流", "安静自习", "刷题练习", "互相讲解", "笔记整理", "项目实践", "打卡监督", "考前冲刺"];
// 每门课的知识点，用来生成“擅长/想补强”
const TOPICS = {
  "高等数学": ["极限", "导数", "积分", "微分方程", "级数"],
  "CS101": ["循环", "函数", "递归", "指针", "调试"],
  "大学英语": ["词汇", "听力", "写作", "口语", "阅读"],
  "线性代数": ["矩阵", "行列式", "特征值", "向量空间"],
  "数据结构": ["链表", "树", "图", "排序", "动态规划"],
};
const GENDERS = ["male", "female", "female", "male", "nonbinary", "undisclosed"];
const CAMPUSES = ["busch", "livingston", "college-ave", "cook-douglass"];
const PERSONALITIES = ["introvert", "ambivert", "extrovert"];
const pick = (arr, n) => [...arr].sort(() => Math.random() - 0.5).slice(0, n);
const one = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

// 示例同学的登录密码（仅本地测试数据）
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
  // 偏向晚上和周末，让匹配更真实
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
console.log(`已生成 ${NAMES.length} 位示例同学，课程：${COURSES.join("、")}`);
console.log(`示例账号：demo-0@example.com ~ demo-${NAMES.length - 1}@example.com，密码 ${DEMO_PASSWORD}`);
