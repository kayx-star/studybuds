import { eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { submitQuiz } from "@/app/group-actions";
import { SubmitButton } from "@/components/submit-button";
import { getDb } from "@/db";
import { requireMember } from "@/db/queries";
import { quizAttempts, quizzes, students, type QuizQuestion } from "@/db/schema";
import { localePath } from "@/i18n/config";
import { displayName } from "@/i18n/names";
import { getI18n } from "@/i18n/server";
import { getTranslator, type Translate } from "@/lib/translate";
import type { Dict } from "@/i18n/zh";
import type { DIFFICULTIES } from "@/lib/constants";

type DiffKey = (typeof DIFFICULTIES)[number]["key"];

const LETTERS = ["A", "B", "C", "D"];

/** 按知识点汇总错题，告诉学生该复习什么 */
function ReviewSummary({
  questions,
  answers,
  t,
  tr,
}: {
  questions: QuizQuestion[];
  answers: number[];
  t: Dict;
  tr: Translate;
}) {
  const missed = new Map<string, number>();
  questions.forEach((q, i) => {
    if (answers[i] !== q.answer) {
      const key = tr(q.concept) || tr(q.question).slice(0, 40);
      missed.set(key, (missed.get(key) ?? 0) + 1);
    }
  });
  if (missed.size === 0) return <p className="card text-sm">{t.quiz.allCorrect}</p>;
  return (
    <section className="card space-y-2 border-red-300">
      <h2 className="font-semibold">{t.quiz.reviewTitle}</h2>
      <ul className="flex flex-wrap gap-2">
        {[...missed].map(([concept, n]) => (
          <li key={concept} className="rounded-full bg-red-500/10 px-3 py-1 text-sm text-red-700">
            {t.quiz.reviewItem(concept, n)}
          </li>
        ))}
      </ul>
    </section>
  );
}

async function QuizDetail({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, { locale, t }] = await Promise.all([params, getI18n()]);
  const tq = t.quiz;
  const db = await getDb();
  const [quiz] = await db.select().from(quizzes).where(eq(quizzes.id, id));
  if (!quiz) notFound();
  const ctx = await requireMember(quiz.groupId);
  if (!ctx) notFound(); // 题目只对组员开放

  const attempts = await db.select().from(quizAttempts).where(eq(quizAttempts.quizId, quiz.id));
  const mine = attempts.find((a) => a.studentId === ctx.me.id);
  const names = new Map(
    (await db.select().from(students).where(inArray(students.id, ctx.group.memberIds))).map((s) => [
      s.id,
      displayName(s.name, locale),
    ]),
  );
  const total = quiz.questions.length;
  const tr = await getTranslator(
    [
      ctx.group.course,
      ctx.group.name,
      quiz.topic,
      ...quiz.questions.flatMap((q) => [q.question, q.explanation, q.concept, ...q.options, ...(q.optionNotes ?? [])]),
    ],
    locale,
  );
  const author = names.get(quiz.createdBy) ?? t.common.member;
  const difficulty = t.options.difficulties[quiz.difficulty as DiffKey] ?? quiz.difficulty;

  return (
    <div className="space-y-6">
      <div>
        <Link href={localePath(locale, `/groups/${quiz.groupId}`)} className="text-sm text-muted hover:text-fg">
          {tq.backTo(tr(ctx.group.name))}
        </Link>
        <div className="mt-3 text-sm text-muted">{tq.header(tr(ctx.group.course), difficulty, total, author)}</div>
        <h1 className="text-2xl font-semibold">{tr(quiz.topic)}</h1>
      </div>

      {mine ? (
        <>
          <section className="card flex flex-wrap items-center gap-6">
            <div>
              <div className="text-sm text-muted">{tq.myScore}</div>
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
                      {["🥇", "🥈", "🥉"][i] ?? `${i + 1}.`} {names.get(a.studentId) ?? t.common.member}
                      {a.studentId === ctx.me.id && <span className="text-xs text-muted">{t.common.me}</span>}
                    </span>
                    <span className="text-muted">{a.score}/{total}</span>
                  </li>
                ))}
              {ctx.group.memberIds
                .filter((mid) => !attempts.some((a) => a.studentId === mid))
                .map((mid) => (
                  <li key={mid} className="flex justify-between text-muted">
                    <span>⏳ {names.get(mid)}</span>
                    <span>{tq.notAnswered}</span>
                  </li>
                ))}
            </ol>
          </section>

          <ReviewSummary questions={quiz.questions} answers={mine.answers} t={t} tr={tr} />

          <ol className="space-y-4">
            {quiz.questions.map((q, i) => {
              const picked = mine.answers[i];
              const right = picked === q.answer;
              return (
                <li key={i} className="card space-y-3">
                  <div className="font-medium">
                    {right ? "✅" : "❌"} {i + 1}. {tr(q.question)}
                  </div>
                  {q.concept && <span className="chip">{tq.concept(tr(q.concept))}</span>}
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
                        {LETTERS[j]}. {tr(opt)}
                        {j === picked && <span className="ml-2 text-xs text-muted">{tq.yourChoice}</span>}
                      </li>
                    ))}
                  </ul>
                  {!right && picked >= 0 && q.optionNotes?.[picked] && (
                    <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm">
                      🔍 {tq.whyWrong(LETTERS[picked])}
                      {tr(q.optionNotes[picked])}
                    </p>
                  )}
                  <p className="rounded-lg bg-accent-soft/60 px-3 py-2 text-sm">💡 {tr(q.explanation)}</p>
                </li>
              );
            })}
          </ol>
        </>
      ) : (
        <form action={submitQuiz} className="space-y-4">
          <input type="hidden" name="quizId" value={quiz.id} />
          <input type="hidden" name="groupId" value={quiz.groupId} />
          <p className="text-sm text-muted">{tq.rules(attempts.length)}</p>
          {quiz.questions.map((q, i) => (
            <fieldset key={i} className="card space-y-2">
              <legend className="sr-only">{tq.question(i + 1)}</legend>
              <div className="font-medium">
                {i + 1}. {tr(q.question)}
              </div>
              {q.options.map((opt, j) => (
                <label key={j} className="flex cursor-pointer items-start gap-2 rounded-lg border border-line px-3 py-2 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
                  <input type="radio" name={`q${i}`} value={j} required className="mt-0.5 accent-[var(--accent)]" />
                  <span>
                    {LETTERS[j]}. {tr(opt)}
                  </span>
                </label>
              ))}
            </fieldset>
          ))}
          <SubmitButton pending={tq.submitting}>{tq.submit}</SubmitButton>
        </form>
      )}
    </div>
  );
}

export default async function QuizPage({ params }: PageProps<"/[lang]/quizzes/[id]">) {
  const { t } = await getI18n();
  return (
    <Suspense fallback={<p className="text-muted">{t.common.loading}</p>}>
      <QuizDetail params={params} />
    </Suspense>
  );
}
