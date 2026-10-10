import { and, eq } from "drizzle-orm";
import { saveReview } from "@/app/group-actions";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { getDb } from "@/db";
import { reviews, type Group, type Student } from "@/db/schema";

const ASPECTS = [
  { key: "reliability", label: "守时靠谱" },
  { key: "contribution", label: "学习贡献" },
  { key: "communication", label: "沟通友好" },
] as const;

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
  const db = await getDb();
  const [given, received] = await Promise.all([
    db.select().from(reviews).where(and(eq(reviews.groupId, group.id), eq(reviews.reviewerId, meId))),
    db.select().from(reviews).where(and(eq(reviews.groupId, group.id), eq(reviews.revieweeId, meId))),
  ]);
  const others = members.filter((m) => m.id !== meId);

  return (
    <section className="card space-y-4">
      <div>
        <h2 className="font-semibold">⭐ 搭子互评</h2>
        <p className="text-xs text-muted">
          评分会汇总显示在大家的匹配卡片上，帮助以后匹配到更靠谱的搭子；评语匿名，只有被评价的人能看到。
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {others.map((m) => {
          const mine = given.find((r) => r.revieweeId === m.id);
          return (
            <ActionForm key={m.id} action={saveReview} className="rounded-xl border border-line p-3 space-y-2">
              <input type="hidden" name="groupId" value={group.id} />
              <input type="hidden" name="revieweeId" value={m.id} />
              <div className="font-medium">
                {m.name} {mine && <span className="chip ml-1">已评价</span>}
              </div>
              {ASPECTS.map((a) => (
                <div key={a.key} className="flex items-center justify-between text-sm">
                  <span className="text-muted">{a.label}</span>
                  <StarInput name={a.key} value={mine?.[a.key]} />
                </div>
              ))}
              <input name="comment" defaultValue={mine?.comment} className="input" placeholder="匿名评语（可选）" />
              <SubmitButton pending="保存中…" variant={mine ? "ghost" : "primary"}>
                {mine ? "更新评价" : "提交评价"}
              </SubmitButton>
            </ActionForm>
          );
        })}
      </div>

      {received.length > 0 && (
        <div className="rounded-xl bg-accent-soft/60 p-3 text-sm">
          <div className="mb-1 text-xs text-muted">组员给你的匿名评价（{received.length} 条）</div>
          <div className="flex flex-wrap gap-4">
            {ASPECTS.map((a) => (
              <span key={a.key}>
                {a.label} <b>{(received.reduce((s, r) => s + r[a.key], 0) / received.length).toFixed(1)}</b>★
              </span>
            ))}
          </div>
          <ul className="mt-2 space-y-1">
            {received
              .filter((r) => r.comment)
              .map((r, i) => (
                <li key={i} className="text-muted">“{r.comment}”</li>
              ))}
          </ul>
        </div>
      )}
    </section>
  );
}
