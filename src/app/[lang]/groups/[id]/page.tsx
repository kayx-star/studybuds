import { eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CodeSpace } from "@/components/group/code-space";
import { InvitePanel } from "@/components/group/invites";
import { LeaveGroupButton } from "@/components/group/leave-button";
import { Quizzes } from "@/components/group/quizzes";
import { Reviews } from "@/components/group/reviews";
import { Sessions } from "@/components/group/sessions";
import { getDb } from "@/db";
import { getRatings } from "@/db/queries";
import { groups, students } from "@/db/schema";
import { localePath } from "@/i18n/config";
import { slotList } from "@/i18n/format";
import { localizeNames } from "@/i18n/names";
import { getI18n } from "@/i18n/server";
import { currentStudentId } from "@/lib/session";
import { getTranslator } from "@/lib/translate";

async function GroupDetail({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, { locale, t }] = await Promise.all([params, getI18n()]);
  const db = await getDb();
  const [group] = await db.select().from(groups).where(eq(groups.id, id));
  if (!group) notFound();

  const [members, sid, ratings] = await Promise.all([
    db
      .select()
      .from(students)
      .where(inArray(students.id, group.memberIds))
      .then((list) => localizeNames(list, locale)),
    currentStudentId(),
    getRatings(),
  ]);
  // 联系方式只对组员可见
  const isMember = sid !== null && group.memberIds.includes(sid);
  const tr = await getTranslator(
    [group.course, group.name, group.reason, ...group.plan.flatMap((p) => [p.title, p.detail]), ...members.map((m) => m.strong)],
    locale,
  );

  return (
    <div className="space-y-6">
      <div>
        <Link href={localePath(locale, "/me")} className="text-sm text-muted hover:text-fg">{t.common.back}</Link>
        <div className="mt-3 text-sm text-muted">{tr(group.course)}</div>
        <h1 className="text-2xl font-semibold">{tr(group.name)}</h1>
        <p className="mt-2 text-muted">{tr(group.reason)}</p>
        {group.byAi && <span className="chip mt-3">{t.group.byAi}</span>}
      </div>

      <InvitePanel group={group} members={members} meId={sid} />

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <h2 className="font-semibold">{t.group.members(members.length)}</h2>
          <span className="text-sm text-muted">
            {t.group.commonFree(slotList(t, group.meetingSlots) || t.group.noCommonSlots)}
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {members.map((m) => {
            const r = ratings.get(m.id);
            return (
              <div key={m.id} className="card space-y-1 !p-4">
                <div className="font-medium">
                  {m.name}
                  {m.id === sid && <span className="ml-1 text-xs text-muted">{t.common.me}</span>}
                  {r && <span className="ml-2 text-xs text-amber-600">★ {r.avg.toFixed(1)}</span>}
                </div>
                <div className="text-xs text-muted">
                  {t.options.paces[m.pace]} · {t.options.goals[m.goal]}
                </div>
                {m.strong && <div className="text-xs">💪 {tr(m.strong)}</div>}
                <div className="text-xs">{isMember ? `📮 ${m.contact}` : t.group.contactHidden}</div>
              </div>
            );
          })}
        </div>
      </section>

      <Sessions group={group} members={members} meId={sid} />
      <Quizzes group={group} members={members} meId={sid} />
      {isMember && <CodeSpace group={group} members={members} />}

      <section className="card space-y-4">
        <h2 className="font-semibold">{t.group.plan}</h2>
        <ol className="space-y-3">
          {group.plan.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="chip h-6 shrink-0">{i + 1}</span>
              <div>
                <div className="font-medium">{tr(step.title)}</div>
                <p className="text-sm text-muted">{tr(step.detail)}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <Reviews group={group} members={members} meId={sid} />

      {isMember && (
        <div className="flex justify-end">
          <LeaveGroupButton
            groupId={group.id}
            label={t.group.leave}
            pending={t.group.leaving}
            confirmText={t.group.leaveConfirm}
          />
        </div>
      )}
    </div>
  );
}

export default async function GroupPage({ params }: PageProps<"/[lang]/groups/[id]">) {
  const { t } = await getI18n();
  return (
    <Suspense fallback={<p className="text-muted">{t.common.loading}</p>}>
      <GroupDetail params={params} />
    </Suspense>
  );
}
