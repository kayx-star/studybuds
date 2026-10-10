import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { formGroup, logout } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { getDb } from "@/db";
import { groups, students } from "@/db/schema";
import { GOALS, MODES, PACES, labelOf, slotLabel } from "@/lib/constants";
import { geminiEnabled } from "@/lib/gemini";
import { recommend } from "@/lib/match";
import { currentStudentId } from "@/lib/session";

async function Dashboard() {
  const sid = await currentStudentId();
  if (!sid) redirect("/join");
  const db = await getDb();
  const [all, allGroups] = await Promise.all([db.select().from(students), db.select().from(groups)]);
  const me = all.find((s) => s.id === sid);
  if (!me) redirect("/join");

  const myGroups = allGroups
    .filter((g) => g.memberIds.includes(me.id))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return (
    <div className="space-y-8">
      <section className="card flex flex-wrap items-start gap-4">
        <div className="flex-1 min-w-60">
          <h1 className="text-xl font-semibold">你好，{me.name}</h1>
          {me.aiSummary && <p className="mt-1 text-sm text-muted">✨ Gemini 画像：{me.aiSummary}</p>}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {[labelOf(PACES, me.pace), labelOf(MODES, me.mode), labelOf(GOALS, me.goal), ...me.tags].map((t) => (
              <span key={t} className="chip">{t}</span>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/join" className="btn-ghost">编辑资料</Link>
          <form action={logout}>
            <button className="btn-ghost">退出</button>
          </form>
        </div>
      </section>

      {myGroups.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">我的小组</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {myGroups.map((g) => (
              <Link key={g.id} href={`/groups/${g.id}`} className="card hover:border-accent">
                <div className="text-xs text-muted">{g.course}</div>
                <div className="font-medium">{g.name}</div>
                <div className="mt-1 text-xs text-muted">
                  {g.memberIds.length} 人 · {g.meetingSlots.slice(0, 3).map(slotLabel).join("、")}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {me.courses.map((course) => {
        const matches = recommend(me, all, course);
        return (
          <section key={course} className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-semibold">{course}</h2>
              <span className="text-sm text-muted">{matches.length} 位推荐搭子</span>
              {matches.length > 0 && (
                <form action={formGroup} className="ml-auto">
                  <input type="hidden" name="course" value={course} />
                  <SubmitButton pending={geminiEnabled ? "Gemini 正在组队…" : "组队中…"}>
                    {geminiEnabled ? "✨ 让 Gemini 帮我组队" : "一键组队"}（{me.groupSize} 人）
                  </SubmitButton>
                </form>
              )}
            </div>
            {matches.length === 0 ? (
              <p className="card text-sm text-muted">
                暂时还没有其他同学选这门课。把网站分享给同班同学吧！
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {matches.map((m) => (
                  <div key={m.student.id} className="card space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{m.student.name}</span>
                      <span className="text-lg font-semibold text-accent">{m.score}</span>
                    </div>
                    {m.student.aiSummary && <p className="text-xs text-muted">{m.student.aiSummary}</p>}
                    <ul className="space-y-0.5 text-sm">
                      {m.reasons.map((r) => (
                        <li key={r}>· {r}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}

      {!geminiEnabled && (
        <p className="text-xs text-muted">
          提示：未配置 GEMINI_API_KEY，当前使用规则算法组队。配置后可启用 Gemini 智能组队与学习计划。
        </p>
      )}
    </div>
  );
}

export default function MePage() {
  return (
    <Suspense fallback={<p className="text-muted">正在计算匹配…</p>}>
      <Dashboard />
    </Suspense>
  );
}
