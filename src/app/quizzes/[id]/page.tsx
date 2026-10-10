import { eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { submitQuiz } from "@/app/group-actions";
import { SubmitButton } from "@/components/submit-button";
import { getDb } from "@/db";
import { requireMember } from "@/db/queries";
import { quizAttempts, quizzes, students } from "@/db/schema";
import { DIFFICULTIES, labelOf } from "@/lib/constants";

const LETTERS = ["A", "B", "C", "D"];

async function QuizDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await getDb();
  const [quiz] = await db.select().from(quizzes).where(eq(quizzes.id, id));
  if (!quiz) notFound();
  const ctx = await requireMember(quiz.groupId);
  if (!ctx) notFound(); // 题目只对组员开放

  const attempts = await db.select().from(quizAttempts).where(eq(quizAttempts.quizId, quiz.id));
  const mine = attempts.find((a) => a.studentId === ctx.me.id);
  const names = new Map(
    (await db.select().from(students).where(inArray(students.id, ctx.group.memberIds))).map((s) => [s.id, s.name]),
  );
  const total = quiz.questions.length;

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/groups/${quiz.groupId}`} className="text-sm text-muted hover:text-fg">← 返回 {ctx.group.name}</Link>
        <div className="mt-3 text-sm text-muted">
          {ctx.group.course} · {labelOf(DIFFICULTIES, quiz.difficulty)} · {total} 题 · {names.get(quiz.createdBy) ?? "组员"} 出题
        </div>
        <h1 className="text-2xl font-semibold">{quiz.topic}</h1>
      </div>

      {mine ? (
        <>
          <section className="card flex flex-wrap items-center gap-6">
            <div>
              <div className="text-sm text-muted">我的成绩</div>
              <div className="text-3xl font-bold text-accent">
                {mine.score}<span className="text-lg text-muted">/{total}</span>
              </div>
            </div>
            <ol className="flex-1 min-w-56 space-y-1 text-sm">
              {[...attempts]
                .sort((a, b) => b.score - a.score || a.createdAt.getTime() - b.createdAt.getTime())
                .map((a, i) => (
                  <li key={a.studentId} className="flex justify-between">
                    <span>
                      {["🥇", "🥈", "🥉"][i] ?? `${i + 1}.`} {names.get(a.studentId) ?? "组员"}
                      {a.studentId === ctx.me.id && <span className="text-xs text-muted">（我）</span>}
                    </span>
                    <span className="text-muted">{a.score}/{total}</span>
                  </li>
                ))}
              {ctx.group.memberIds
                .filter((mid) => !attempts.some((a) => a.studentId === mid))
                .map((mid) => (
                  <li key={mid} className="flex justify-between text-muted">
                    <span>⏳ {names.get(mid)}</span>
                    <span>未作答</span>
                  </li>
                ))}
            </ol>
          </section>

          <ol className="space-y-4">
            {quiz.questions.map((q, i) => {
              const picked = mine.answers[i];
              const right = picked === q.answer;
              return (
                <li key={i} className="card space-y-3">
                  <div className="font-medium">
                    {right ? "✅" : "❌"} {i + 1}. {q.question}
                  </div>
                  <ul className="space-y-1.5 text-sm">
                    {q.options.map((opt, j) => (
                      <li
                        key={j}
                        className={`rounded-lg border px-3 py-2 ${
                          j === q.answer
                            ? "border-emerald-500 bg-emerald-500/10"
                            : j === picked
                              ? "border-red-400 bg-red-500/10"
                              : "border-line"
                        }`}
                      >
                        {LETTERS[j]}. {opt}
                        {j === picked && <span className="ml-2 text-xs text-muted">（你的选择）</span>}
                      </li>
                    ))}
                  </ul>
                  <p className="rounded-lg bg-accent-soft/60 px-3 py-2 text-sm">💡 {q.explanation}</p>
                </li>
              );
            })}
          </ol>
        </>
      ) : (
        <form action={submitQuiz} className="space-y-4">
          <input type="hidden" name="quizId" value={quiz.id} />
          <input type="hidden" name="groupId" value={quiz.groupId} />
          <p className="text-sm text-muted">
            每人只有一次作答机会，交卷后可以看到答案解析和组内排名。已有 {attempts.length} 人交卷。
          </p>
          {quiz.questions.map((q, i) => (
            <fieldset key={i} className="card space-y-2">
              <legend className="sr-only">第 {i + 1} 题</legend>
              <div className="font-medium">
                {i + 1}. {q.question}
              </div>
              {q.options.map((opt, j) => (
                <label key={j} className="flex cursor-pointer items-start gap-2 rounded-lg border border-line px-3 py-2 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
                  <input type="radio" name={`q${i}`} value={j} required className="mt-0.5 accent-[var(--accent)]" />
                  <span>
                    {LETTERS[j]}. {opt}
                  </span>
                </label>
              ))}
            </fieldset>
          ))}
          <SubmitButton pending="交卷中…">交卷</SubmitButton>
        </form>
      )}
    </div>
  );
}

export default function QuizPage({ params }: PageProps<"/quizzes/[id]">) {
  return (
    <Suspense fallback={<p className="text-muted">加载中…</p>}>
      <QuizDetail params={params} />
    </Suspense>
  );
}
