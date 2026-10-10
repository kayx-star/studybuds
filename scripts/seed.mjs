// 生成示例同学，方便本地体验匹配：npm run seed
import { createClient } from "@libsql/client";
import { readFileSync } from "node:fs";

const client = createClient({ url: process.env.DATABASE_URL ?? "file:local.db", authToken: process.env.DATABASE_AUTH_TOKEN });
const ddl = readFileSync(new URL("../src/db/schema.ts", import.meta.url), "utf8").match(/export const DDL = `([\s\S]*?)`;/)[1];
await client.executeMultiple(ddl);

const NAMES = ["小林", "阿杰", "Momo", "晓雨", "大鹏", "Coco", "子轩", "一一", "老王", "Yuki", "思远", "安安", "Leo", "糖糖", "浩然", "七七", "阿诚", "Nina", "可乐", "北北"];
const COURSES = ["高等数学", "CS101", "大学英语", "线性代数", "数据结构"];
const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const PERIODS = ["am", "pm", "eve"];
const TAGS = ["讨论交流", "安静自习", "刷题练习", "互相讲解", "笔记整理", "项目实践", "打卡监督", "考前冲刺"];
const pick = (arr, n) => [...arr].sort(() => Math.random() - 0.5).slice(0, n);
const one = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

await client.execute("DELETE FROM students WHERE contact LIKE 'demo-%'");
for (const [i, name] of NAMES.entries()) {
  // 偏向晚上和周末，让匹配更真实
  const slots = pick(DAYS.flatMap((d) => PERIODS.map((p) => `${d}-${p}`)).filter((s) => s.endsWith("eve") || s.startsWith("sat") || s.startsWith("sun") || Math.random() < 0.2), rand(3, 7));
  await client.execute({
    sql: `INSERT INTO students (id, name, contact, courses, slots, pace, mode, goal, tags, group_size, bio, ai_summary, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', NULL, ?)`,
    args: [crypto.randomUUID(), name, `demo-${i}@example.com`, JSON.stringify(pick(COURSES, rand(1, 3))), JSON.stringify(slots),
      one(["slow", "medium", "fast"]), one(["online", "offline", "either"]), one(["pass", "good", "deep"]),
      JSON.stringify(pick(TAGS, rand(1, 3))), rand(2, 4), Date.now()],
  });
}
console.log(`已生成 ${NAMES.length} 位示例同学，课程：${COURSES.join("、")}`);
