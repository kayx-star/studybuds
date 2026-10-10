import { desc, eq } from "drizzle-orm";
import { connection } from "next/server";
import { cancelSession, toggleAttend } from "@/app/group-actions";
import { getDb } from "@/db";
import { studySessions, type Group, type Student } from "@/db/schema";
import { formatSession, nextOccurrences, ymd } from "@/lib/schedule";
import { SessionForm } from "./session-form";

export async function Sessions({ group, members, meId }: { group: Group; members: Student[]; meId: string | null }) {
  await connection();
  const now = new Date();
  const today = ymd(now);
  const db = await getDb();
  const all = await db
    .select()
    .from(studySessions)
    .where(eq(studySessions.groupId, group.id))
    .orderBy(desc(studySessions.date));
  const upcoming = all.filter((s) => s.date >= today).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  const past = all.filter((s) => s.date < today).slice(0, 5);
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? "已退出";
  const isMember = meId !== null && group.memberIds.includes(meId);

  return (
    <section className="card space-y-4">
      <h2 className="font-semibold">📅 约自习</h2>

      {upcoming.length === 0 ? (
        <p className="text-sm text-muted">还没有安排，发起第一次自习吧。</p>
      ) : (
        <ul className="space-y-3">
          {upcoming.map((s) => {
            const going = meId !== null && s.attendees.includes(meId);
            return (
              <li key={s.id} className="rounded-xl border border-line p-3">
                <div className="flex flex-wrap items-start gap-2">
                  <div className="flex-1 min-w-48">
                    <div className="font-medium">{formatSession(s.date, s.start, s.minutes)}</div>
                    <div className="text-sm text-muted">
                      📍 {/^https?:\/\//.test(s.place) ? <a href={s.place} target="_blank" rel="noreferrer" className="text-accent underline">{s.place}</a> : s.place}
                      {s.topic && ` · ${s.topic}`}
                    </div>
                    <div className="mt-1 text-xs text-muted">
                      {nameOf(s.createdBy)} 发起 · 参加（{s.attendees.length}/{group.memberIds.length}）：
                      {s.attendees.map(nameOf).join("、")}
                    </div>
                  </div>
                  {isMember && (
                    <div className="flex gap-2">
                      <form action={toggleAttend}>
                        <input type="hidden" name="groupId" value={group.id} />
                        <input type="hidden" name="sessionId" value={s.id} />
                        <button className={going ? "btn-ghost" : "btn"}>{going ? "取消报名" : "我参加"}</button>
                      </form>
                      <a href={`/sessions/${s.id}/ics`} className="btn-ghost" title="下载 .ics，导入手机/电脑日历">
                        加入日历
                      </a>
                      {s.createdBy === meId && (
                        <form action={cancelSession}>
                          <input type="hidden" name="groupId" value={group.id} />
                          <input type="hidden" name="sessionId" value={s.id} />
                          <button className="btn-ghost text-red-600">取消自习</button>
                        </form>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {isMember && (
        <details className="group/details">
          <summary className="cursor-pointer text-sm text-accent">+ 发起新的自习</summary>
          <div className="mt-3">
            <SessionForm groupId={group.id} suggestions={nextOccurrences(group.meetingSlots, now)} today={today} />
          </div>
        </details>
      )}

      {past.length > 0 && (
        <div className="text-xs text-muted">
          最近完成：{past.map((s) => `${formatSession(s.date, s.start, s.minutes).split(" ")[0]}（${s.attendees.length} 人）`).join("、")}
        </div>
      )}
    </section>
  );
}
