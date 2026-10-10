import { count } from "drizzle-orm";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { getDb } from "@/db";
import { groups, students } from "@/db/schema";

async function Stats() {
  await connection();
  const db = await getDb();
  const [[s], [g]] = await Promise.all([
    db.select({ n: count() }).from(students),
    db.select({ n: count() }).from(groups),
  ]);
  return (
    <p className="text-sm text-muted">
      已有 <b className="text-fg">{s.n}</b> 位同学加入，组成了 <b className="text-fg">{g.n}</b> 个学习小组
    </p>
  );
}

const STEPS = [
  { title: "填写资料", body: "在学课程、每周空闲时间、学习节奏和风格，再写几句自我介绍。" },
  { title: "智能匹配", body: "按共同时间、节奏、目标和风格打分，Gemini 读懂你的自我介绍补充画像。" },
  { title: "一键组队", body: "Gemini 从候选人里挑出最合拍的组员，并生成小组的每周学习计划。" },
];

export default function Home() {
  return (
    <div className="space-y-12 py-6">
      <section className="space-y-5">
        <h1 className="text-4xl font-bold leading-tight">
          找到和你<span className="text-accent">同课、同时间、同节奏</span>的学习搭子
        </h1>
        <p className="max-w-2xl text-muted">
          一个人学容易拖延。告诉我们你的课程和习惯，我们帮你找到合拍的同学，组成小组一起学。
        </p>
        <div className="flex gap-3">
          <Link href="/join" className="btn">开始匹配</Link>
          <Link href="/me" className="btn-ghost">查看我的小组</Link>
        </div>
        <Suspense fallback={<p className="text-sm text-muted">&nbsp;</p>}>
          <Stats />
        </Suspense>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {STEPS.map((s, i) => (
          <div key={s.title} className="card">
            <div className="chip mb-3">第 {i + 1} 步</div>
            <h3 className="font-semibold">{s.title}</h3>
            <p className="mt-1 text-sm text-muted">{s.body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
