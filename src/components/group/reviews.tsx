import { and, eq } from "drizzle-orm";
import { saveReview } from "@/app/group-actions";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { getDb } from "@/db";
import { reviews, students, type Group, type Student } from "@/db/schema";
import { localizeNames } from "@/i18n/names";
import { getTranslator } from "@/lib/translate";
import { getI18n } from "@/i18n/server";

const ASPECTS = ["reliability", "contribution", "communication"] as const;

function StarInput({ name, value }: { name: string; value?: number }) {
  // 5 个单选按钮，倒序渲染再 flex-row-reverse 显示，选中项和排在它后面（视觉上在左侧）的星星点亮
  return (
    <div className="inline-flex flex-row-reverse justify-end">
      {[5, 4, 3, 2, 1].map((n) => (
        <label key={n} className="cursor-pointer">
          <input type="radio" name={name} value={n} defaultChecked={value === n} className="peer sr-only" />
          <span className="px-0.5 text-xl text-line peer-checked:text-amber-500 [label:has(input:checked)~label>&]:text-amber-500">
            ★
          </span>
        </label>
      ))}
    </div>
  );
}

export async function Reviews({ group, members, meId }: { group: Group; members: Student[]; meId: string | null }) {
  if (meId === null || !group.memberIds.includes(meId)) return null;
  const { locale, t } = await getI18n();
  const r = t.reviews;
  const db = await getDb();
  const [given, received] = await Promise.all([
    db.select().from(reviews).where(and(eq(reviews.groupId, group.id), eq(reviews.reviewerId, meId))),
    db.select().from(reviews).where(and(eq(reviews.groupId, group.id), eq(reviews.revieweeId, meId))),
  ]);
  const others = members.filter((m) => m.id !== meId);
  // 署名评价的人可能已退出小组，所以从全部同学里找昵称
  const all = localizeNames(await db.select().from(students), locale);
  const tr = await getTranslator(received.map((x) => x.comment), locale);

  return (
    <section className="card space-y-4">
      <div>
        <h2 className="font-semibold">{r.title}</h2>
        <p className="text-xs text-muted">{r.hint}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {others.map((m) => {
          const mine = given.find((x) => x.revieweeId === m.id);
          return (
            <ActionForm key={m.id} action={saveReview} className="rounded-xl border border-line p-3 space-y-2">
              <input type="hidden" name="groupId" value={group.id} />
              <input type="hidden" name="revieweeId" value={m.id} />
              <div className="font-medium">
                {m.name} {mine && <span className="chip ml-1">{r.reviewed}</span>}
              </div>
              {ASPECTS.map((a) => (
                <div key={a} className="flex items-center justify-between text-sm">
                  <span className="text-muted">{r[a]}</span>
                  <StarInput name={a} value={mine?.[a]} />
                </div>
              ))}
              <input name="comment" defaultValue={mine?.comment} className="input" placeholder={r.commentPlaceholder} />
              <label className="flex items-center gap-2 text-xs text-muted">
                <input
                  type="checkbox"
                  name="anonymous"
                  defaultChecked={mine?.anonymous ?? true}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
                {r.anonymous}
              </label>
              <SubmitButton pending={r.saving} variant={mine ? "ghost" : "primary"}>
                {mine ? r.update : r.submit}
              </SubmitButton>
            </ActionForm>
          );
        })}
      </div>

      {received.length > 0 && (
        <div className="rounded-xl bg-accent-soft/60 p-3 text-sm">
          <div className="mb-1 text-xs text-muted">{r.received(received.length)}</div>
          <div className="flex flex-wrap gap-4">
            {ASPECTS.map((a) => (
              <span key={a}>
                {r[a]} <b>{(received.reduce((s, x) => s + x[a], 0) / received.length).toFixed(1)}</b>★
              </span>
            ))}
          </div>
          <ul className="mt-2 space-y-1">
            {received
              .filter((x) => x.comment)
              .map((x, i) => (
                <li key={i} className="text-muted">
                  “{tr(x.comment)}” — {x.anonymous ? r.anonymousName : (all.find((m) => m.id === x.reviewerId)?.name ?? r.anonymousName)}
                </li>
              ))}
          </ul>
        </div>
      )}
    </section>
  );
}
