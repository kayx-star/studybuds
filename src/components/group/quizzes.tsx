import { desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { createQuiz } from "@/app/group-actions";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { getDb } from "@/db";
import { quizAttempts, quizzes, type Group, type Student } from "@/db/schema";
import { localePath } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { DIFFICULTIES } from "@/lib/constants";
import { geminiEnabled } from "@/lib/gemini";

type DiffKey = (typeof DIFFICULTIES)[number]["key"];

export async function Quizzes({ group, members, meId }: { group: Group; members: Student[]; meId: string | null }) {
  const { locale, t } = await getI18n();
  const q = t.quiz;
  const db = await getDb();
  const list = await db.select().from(quizzes).where(eq(quizzes.groupId, group.id)).orderBy(desc(quizzes.createdAt));
  const attempts = list.length
    ? await db.select().from(quizAttempts).where(inArray(quizAttempts.quizId, list.map((x) => x.id)))
    : [];
  const isMember = meId !== null && group.memberIds.includes(meId);

  // 小组总榜：累计答对题数
  const board = members
    .map((m) => {
      const mine = attempts.filter((a) => a.studentId === m.id);
      return { m, correct: mine.reduce((s, a) => s + a.score, 0), done: mine.length };
    })
    .sort((a, b) => b.correct - a.correct || b.done - a.done);
  const medal = ["🥇", "🥈", "🥉"];

  return (
    <section className="card space-y-4">
      <h2 className="font-semibold">{q.title}</h2>

      {attempts.length > 0 && (
        <div className="rounded-xl bg-accent-soft/60 p-3">
          <div className="mb-2 text-xs text-muted">{q.board}</div>
          <ol className="space-y-1 text-sm">
            {board.map((b, i) => (
              <li key={b.m.id} className="flex justify-between gap-3">
                <span>
                  {medal[i] ?? `${i + 1}.`} {b.m.name}
                  {b.m.id === meId && <span className="text-xs text-muted">{t.common.me}</span>}
                </span>
                <span className="text-muted">{q.boardRow(b.correct, b.done)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {list.length === 0 ? (
        <p className="text-sm text-muted">{q.empty}</p>
      ) : (
        <ul className="divide-y divide-line">
          {list.map((x) => {
            const done = attempts.filter((a) => a.quizId === x.id);
            const mine = done.find((a) => a.studentId === meId);
            return (
              <li key={x.id}>
                <Link href={localePath(locale, `/quizzes/${x.id}`)} className="flex items-center gap-3 py-2.5 hover:text-accent">
                  <div className="flex-1">
                    <div className="font-medium">{x.topic}</div>
                    <div className="text-xs text-muted">
                      {q.meta(
                        x.questions.length,
                        t.options.difficulties[x.difficulty as DiffKey] ?? x.difficulty,
                        members.find((m) => m.id === x.createdBy)?.name ?? t.common.member,
                        done.length,
                        members.length,
                      )}
                    </div>
                  </div>
                  {mine ? (
                    <span className="chip">
                      {mine.score}/{x.questions.length}
                    </span>
                  ) : (
                    isMember && <span className="btn !px-3 !py-1">{q.take}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {isMember &&
        (geminiEnabled ? (
          <details>
            <summary className="cursor-pointer text-sm text-accent">{q.newQuiz}</summary>
            <ActionForm action={createQuiz} className="mt-3 space-y-3">
              <input type="hidden" name="groupId" value={group.id} />
              <input name="topic" className="input" placeholder={q.topicPlaceholder(group.course)} />
              <textarea name="notes" rows={3} className="input" placeholder={q.notesPlaceholder} />
              <div className="flex flex-wrap gap-3">
                <select name="count" defaultValue={5} className="input !w-auto">
                  {[3, 5, 8, 10].map((n) => (
                    <option key={n} value={n}>{q.count(n)}</option>
                  ))}
                </select>
                <select name="difficulty" defaultValue="medium" className="input !w-auto">
                  {DIFFICULTIES.map((d) => (
                    <option key={d.key} value={d.key}>{t.options.difficulties[d.key]}</option>
                  ))}
                </select>
                <SubmitButton pending={q.generating}>{q.generate}</SubmitButton>
              </div>
            </ActionForm>
          </details>
        ) : (
          <p className="text-xs text-muted">{q.needGemini}</p>
        ))}
    </section>
  );
}
