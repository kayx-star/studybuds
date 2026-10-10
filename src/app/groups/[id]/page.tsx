import { eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getDb } from "@/db";
import { groups, students } from "@/db/schema";
import { GOALS, PACES, labelOf, slotLabel } from "@/lib/constants";
import { currentStudentId } from "@/lib/session";

async function GroupDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await getDb();
  const [group] = await db.select().from(groups).where(eq(groups.id, id));
  if (!group) notFound();

  const [members, sid] = await Promise.all([
    db.select().from(students).where(inArray(students.id, group.memberIds)),
    currentStudentId(),
  ]);
  // 联系方式只对组员可见
  const isMember = sid !== null && group.memberIds.includes(sid);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/me" className="text-sm text-muted hover:text-fg">← 返回</Link>
        <div className="mt-3 text-sm text-muted">{group.course}</div>
        <h1 className="text-2xl font-semibold">{group.name}</h1>
        <p className="mt-2 text-muted">{group.reason}</p>
        {group.byAi && <span className="chip mt-3">✨ 由 Gemini 组队并制定计划</span>}
      </div>

      <section className="card">
        <h2 className="mb-3 font-semibold">共同空闲时间</h2>
        <div className="flex flex-wrap gap-2">
          {group.meetingSlots.map((s) => (
            <span key={s} className="chip text-sm">{slotLabel(s)}</span>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">成员（{members.length}）</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {members.map((m) => (
            <div key={m.id} className="card space-y-1">
              <div className="font-medium">
                {m.name}
                {m.id === sid && <span className="ml-2 text-xs text-muted">（我）</span>}
              </div>
              <div className="text-xs text-muted">
                {labelOf(PACES, m.pace)} · {labelOf(GOALS, m.goal)} · {m.tags.join("、")}
              </div>
              <div className="text-sm">{isMember ? `联系方式：${m.contact}` : "联系方式仅组员可见"}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="font-semibold">学习计划</h2>
        <ol className="space-y-3">
          {group.plan.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="chip h-6 shrink-0">{i + 1}</span>
              <div>
                <div className="font-medium">{step.title}</div>
                <p className="text-sm text-muted">{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

export default function GroupPage({ params }: PageProps<"/groups/[id]">) {
  return (
    <Suspense fallback={<p className="text-muted">加载中…</p>}>
      <GroupDetail params={params} />
    </Suspense>
  );
}
