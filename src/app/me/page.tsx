import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { findComplements, formGroup, logout } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { getDb } from "@/db";
import { getRatings } from "@/db/queries";
import { complements, groups, students, type Student } from "@/db/schema";
import { GOALS, MODES, PACES, labelOf, slotLabel } from "@/lib/constants";
import { geminiEnabled } from "@/lib/gemini";
import { complementPool, recommend, type MatchMode } from "@/lib/match";
import type { Rating } from "@/lib/ratings";
import { currentStudentId } from "@/lib/session";

function Stars({ rating }: { rating?: Rating }) {
  if (!rating) return null;
  return (
    <span className="text-xs text-amber-600" title={`${rating.count} 条互评`}>
      ★ {rating.avg.toFixed(1)}
    </span>
  );
}

function GroupButton({ course, mode, size }: { course: string; mode: MatchMode; size: number }) {
  return (
    <form action={formGroup}>
      <input type="hidden" name="course" value={course} />
      <input type="hidden" name="mode" value={mode} />
      <SubmitButton pending={geminiEnabled ? "Gemini 正在组队…" : "组队中…"}>
        {geminiEnabled ? "✨ 让 Gemini 帮我组队" : "一键组队"}（{size} 人）
      </SubmitButton>
    </form>
  );
}

function SimilarCourse({ me, all, course, ratings }: { me: Student; all: Student[]; course: string; ratings: Map<string, Rating> }) {
  const matches = recommend(me, all, course, ratings);
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold">{course}</h2>
        <span className="text-sm text-muted">{matches.length} 位推荐搭子</span>
        {matches.length > 0 && (
          <div className="ml-auto">
            <GroupButton course={course} mode="similar" size={me.groupSize} />
          </div>
        )}
      </div>
      {matches.length === 0 ? (
        <p className="card text-sm text-muted">暂时还没有其他同学选这门课。把网站分享给同班同学吧！</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {matches.map((m) => (
            <div key={m.student.id} className="card space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">
                  {m.student.name} <Stars rating={ratings.get(m.student.id)} />
                </span>
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
}

async function ComplementCourse({ me, all, course, ratings }: { me: Student; all: Student[]; course: string; ratings: Map<string, Rating> }) {
  const db = await getDb();
  const [cached] = await db
    .select()
    .from(complements)
    .where(and(eq(complements.studentId, me.id), eq(complements.course, course)));
  const pool = complementPool(me, all, course);
  const byId = new Map(all.map((s) => [s.id, s]));
  const picks = (cached?.picks ?? []).filter((p) => byId.has(p.id));

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold">{course}</h2>
        <span className="text-sm text-muted">{pool.length} 位时间合适的同学</span>
        {pool.length > 0 && (
          <div className="ml-auto flex flex-wrap gap-2">
            <form action={findComplements}>
              <input type="hidden" name="course" value={course} />
              <SubmitButton pending="分析中…" variant={cached ? "ghost" : "primary"}>
                {cached ? "重新分析" : geminiEnabled ? "✨ 让 Gemini 找互补搭子" : "查找互补搭子"}
              </SubmitButton>
            </form>
            {cached && <GroupButton course={course} mode="complement" size={me.groupSize} />}
          </div>
        )}
      </div>
      {pool.length === 0 ? (
        <p className="card text-sm text-muted">这门课暂时没有和你时间合得上的同学。</p>
      ) : !cached ? (
        <p className="card text-sm text-muted">
          {me.strong || me.weak
            ? "点击右上角按钮，分析谁能和你互相帮助。"
            : "先去「我的资料」填写“我擅长”和“我想补强”，互补匹配会准确很多。"}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {picks.map((p) => {
            const s = byId.get(p.id)!;
            return (
              <div key={p.id} className="card space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">
                    {s.name} <Stars rating={ratings.get(s.id)} />
                  </span>
                  <span className="text-lg font-semibold text-accent">{p.score}</span>
                </div>
                <p className="text-sm">{p.reason}</p>
                <div className="text-xs text-muted space-y-0.5">
                  {s.strong && <div>擅长：{s.strong}</div>}
                  {s.weak && <div>想补强：{s.weak}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {cached && (
        <p className="text-xs text-muted">
          {cached.byAi ? "✨ Gemini" : "规则"}分析于 {cached.createdAt.toLocaleString("zh-CN")}
        </p>
      )}
    </section>
  );
}

async function Dashboard({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const mode: MatchMode = (await searchParams).mode === "complement" ? "complement" : "similar";
  const sid = await currentStudentId();
  if (!sid) redirect("/join");
  const db = await getDb();
  const [all, allGroups, ratings] = await Promise.all([
    db.select().from(students),
    db.select().from(groups),
    getRatings(),
  ]);
  const me = all.find((s) => s.id === sid);
  if (!me) redirect("/join");

  const myGroups = allGroups
    .filter((g) => g.memberIds.includes(me.id))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const myRating = ratings.get(me.id);

  const tab = (m: MatchMode, label: string, hint: string) => (
    <Link
      href={m === "similar" ? "/me" : "/me?mode=complement"}
      className={`flex-1 rounded-xl px-4 py-2 text-center text-sm ${mode === m ? "bg-surface shadow-sm font-medium" : "text-muted hover:text-fg"}`}
    >
      {label}
      <span className="block text-xs font-normal text-muted">{hint}</span>
    </Link>
  );

  return (
    <div className="space-y-8">
      <section className="card flex flex-wrap items-start gap-4">
        <div className="flex-1 min-w-60">
          <h1 className="text-xl font-semibold">
            你好，{me.name}
            {myRating && (
              <span className="ml-2 text-sm font-normal text-amber-600">
                ★ {myRating.avg.toFixed(1)}（{myRating.count} 条互评）
              </span>
            )}
          </h1>
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

      <div className="flex gap-1 rounded-2xl bg-accent-soft p-1">
        {tab("similar", "相似匹配", "时间、节奏、风格相近")}
        {tab("complement", "互补匹配", "你的弱项正是 TA 的强项")}
      </div>

      {me.courses.map((course) =>
        mode === "similar" ? (
          <SimilarCourse key={course} me={me} all={all} course={course} ratings={ratings} />
        ) : (
          <ComplementCourse key={course} me={me} all={all} course={course} ratings={ratings} />
        ),
      )}

      {!geminiEnabled && (
        <p className="text-xs text-muted">
          提示：未配置 GEMINI_API_KEY，当前使用规则算法。配置后可启用 Gemini 智能组队、互补分析与出题。
        </p>
      )}
    </div>
  );
}

export default function MePage({ searchParams }: PageProps<"/me">) {
  return (
    <Suspense fallback={<p className="text-muted">正在计算匹配…</p>}>
      <Dashboard searchParams={searchParams as Promise<{ mode?: string }>} />
    </Suspense>
  );
}
