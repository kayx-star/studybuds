import { and, eq } from "drizzle-orm";
import { inviteMore, respondInvite } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { getDb } from "@/db";
import { getRatings } from "@/db/queries";
import { invites, students, type Group, type Student } from "@/db/schema";
import { localizeNames } from "@/i18n/names";
import { getI18n } from "@/i18n/server";
import { compatible, recommend } from "@/lib/match";

/** 小组页上的邀请区：被邀请人看到接受/婉拒；组员看到待回复名单并可继续邀请 */
export async function InvitePanel({ group, members, meId }: { group: Group; members: Student[]; meId: string | null }) {
  const { locale, t } = await getI18n();
  const db = await getDb();
  const pending = await db
    .select()
    .from(invites)
    .where(and(eq(invites.groupId, group.id), eq(invites.status, "pending")));
  if (!meId) return null;

  const all = localizeNames(await db.select().from(students), locale);
  const nameOf = (id: string) => all.find((s) => s.id === id)?.name ?? t.common.left;
  const mine = pending.find((i) => i.inviteeId === meId);

  if (mine) {
    return (
      <section className="card flex flex-wrap items-center gap-3 border-accent bg-accent-soft/40">
        <p className="flex-1 min-w-56 text-sm">{t.group.invitedBanner(nameOf(mine.inviterId))}</p>
        <form action={respondInvite}>
          <input type="hidden" name="inviteId" value={mine.id} />
          <input type="hidden" name="decision" value="decline" />
          <button className="btn-ghost">{t.me.decline}</button>
        </form>
        <form action={respondInvite}>
          <input type="hidden" name="inviteId" value={mine.id} />
          <input type="hidden" name="decision" value="accept" />
          <button className="btn">{t.me.accept}</button>
        </form>
      </section>
    );
  }

  if (!group.memberIds.includes(meId)) return null;
  const me = all.find((s) => s.id === meId)!;
  // 可邀请：同课、不在组里、没被邀请、且与所有现有组员偏好兼容
  const candidates = recommend(me, all, group.course, await getRatings()).filter(
    (m) =>
      !group.memberIds.includes(m.student.id) &&
      !pending.some((i) => i.inviteeId === m.student.id) &&
      members.every((x) => compatible(x, m.student)),
  );

  return (
    <section className="space-y-2">
      {pending.length > 0 && (
        <p className="text-sm text-muted">⏳ {t.group.pending(t.list(pending.map((i) => nameOf(i.inviteeId))))}</p>
      )}
      <details>
        <summary className="cursor-pointer text-sm text-accent">{t.group.inviteMore}</summary>
        {candidates.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{t.group.noCandidates}</p>
        ) : (
          <ActionForm action={inviteMore} className="mt-3 space-y-3">
            <input type="hidden" name="groupId" value={group.id} />
            <div className="grid gap-2 sm:grid-cols-2">
              {candidates.slice(0, 6).map((m) => (
                <label key={m.student.id} className="card !p-3 flex items-center gap-2 cursor-pointer has-[:checked]:border-accent">
                  <input type="checkbox" name="invitee" value={m.student.id} className="h-4 w-4 accent-[var(--accent)]" />
                  <span className="flex-1 font-medium">{m.student.name}</span>
                  <span className="text-xs text-muted" title={t.me.scoreHelp}>
                    {t.me.scoreLabel} <b className="text-accent">{m.score}</b>
                  </span>
                </label>
              ))}
            </div>
            <SubmitButton pending={t.me.sendingInvites}>{t.me.sendInvites}</SubmitButton>
          </ActionForm>
        )}
      </details>
    </section>
  );
}
