import { desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { createQuiz } from "@/app/group-actions";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { getDb } from "@/db";
import { quizAttempts, quizzes, type Group, type Student } from "@/db/schema";
import { DIFFICULTIES, labelOf } from "@/lib/constants";
import { geminiEnabled } from "@/lib/gemini";

export async function Quizzes({ group, members, meId }: { group: Group; members: Student[]; meId: string | null }) {
  const db = await getDb();
  const list = await db.select().from(quizzes).where(eq(quizzes.groupId, group.id)).orderBy(desc(quizzes.createdAt));
  const attempts = list.length
    ? await db.select().from(quizAttempts).where(inArray(quizAttempts.quizId, list.map((q) => q.id)))
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
      <h2 className="font-semibold">🏆 AI 出题 · 组内比拼</h2>

      {attempts.length > 0 && (
        <div className="rounded-xl bg-accent-soft/60 p-3">
          <div className="mb-2 text-xs text-muted">小组总榜（累计答对题数）</div>
          <ol className="space-y-1 text-sm">
            {board.map((b, i) => (
              <li key={b.m.id} className="flex justify-between">
                <span>
                  {medal[i] ?? `${i + 1}.`} {b.m.name}
                  {b.m.id === meId && <span className="text-xs text-muted">（我）</span>}
                </span>
                <span className="text-muted">
                  <b className="text-fg">{b.correct}</b> 题 · 参与 {b.done} 次
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {list.length === 0 ? (
        <p className="text-sm text-muted">还没有题目。输入本周学的章节，让 Gemini 出一套题大家比一比。</p>
      ) : (
        <ul className="divide-y divide-line">
          {list.map((q) => {
            const done = attempts.filter((a) => a.quizId === q.id);
            const mine = done.find((a) => a.studentId === meId);
            return (
              <li key={q.id}>
                <Link href={`/quizzes/${q.id}`} className="flex items-center gap-3 py-2.5 hover:text-accent">
                  <div className="flex-1">
                    <div className="font-medium">{q.topic}</div>
                    <div className="text-xs text-muted">
                      {q.questions.length} 题 · {labelOf(DIFFICULTIES, q.difficulty)} ·{" "}
                      {members.find((m) => m.id === q.createdBy)?.name ?? "组员"} 出题 · {done.length}/{members.length} 人已答
                    </div>
                  </div>
                  {mine ? (
                    <span className="chip">
                      {mine.score}/{q.questions.length}
                    </span>
                  ) : (
                    isMember && <span className="btn !px-3 !py-1">去答题</span>
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
            <summary className="cursor-pointer text-sm text-accent">+ 让 Gemini 出一套新题</summary>
            <ActionForm action={createQuiz} className="mt-3 space-y-3">
              <input type="hidden" name="groupId" value={group.id} />
              <input name="topic" className="input" placeholder={`章节或知识点，如：${group.course} 第三章 / 定积分的换元法`} />
              <textarea
                name="notes"
                rows={3}
                className="input"
                placeholder="（可选）粘贴课堂笔记或课件文字，Gemini 会优先根据它出题"
              />
              <div className="flex flex-wrap gap-3">
                <select name="count" defaultValue={5} className="input !w-auto">
                  {[3, 5, 8, 10].map((n) => (
                    <option key={n} value={n}>{n} 题</option>
                  ))}
                </select>
                <select name="difficulty" defaultValue="medium" className="input !w-auto">
                  {DIFFICULTIES.map((d) => (
                    <option key={d.key} value={d.key}>{d.label}</option>
                  ))}
                </select>
                <SubmitButton pending="Gemini 正在出题…">✨ 生成题目</SubmitButton>
              </div>
            </ActionForm>
          </details>
        ) : (
          <p className="text-xs text-muted">配置 GEMINI_API_KEY 后可使用 AI 出题。</p>
        ))}
    </section>
  );
}
