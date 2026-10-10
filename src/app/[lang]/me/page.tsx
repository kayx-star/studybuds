import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { findComplements, formGroup, inviteToNewGroup, respondInvite } from "@/app/actions";
import { logout } from "@/app/auth-actions";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { getDb } from "@/db";
import { getRatings } from "@/db/queries";
import { complements, groups, invites, students, type Group, type Invite, type Student } from "@/db/schema";
import { localePath, type Locale } from "@/i18n/config";
import { formatDateTime, reasonText, slotList, tagLabel } from "@/i18n/format";
import { localizeNames } from "@/i18n/names";
import { getI18n } from "@/i18n/server";
import type { Dict } from "@/i18n/zh";
import { geminiEnabled } from "@/lib/gemini";
import { complementPool, recommend, type MatchMode } from "@/lib/match";
import type { Rating } from "@/lib/ratings";
import { currentStudentId } from "@/lib/session";
import { getTranslator, type Translate } from "@/lib/translate";

type Ctx = {
  me: Student;
  all: Student[];
  course: string;
  ratings: Map<string, Rating>;
  t: Dict;
  locale: Locale;
  /** 我已邀请过、还没回复的同学 id（按课程） */
  invitedIds: Set<string>;
  /** 把用户内容/AI 内容换成当前语言 */
  tr: Translate;
};

function Score({ score, t }: { score: number; t: Dict }) {
  return (
    <span className="text-right leading-tight" title={t.me.scoreHelp}>
      <span className="block text-[10px] uppercase tracking-wide text-muted">{t.me.scoreLabel}</span>
      <span className="text-lg font-semibold text-accent">{score}</span>
    </span>
  );
}

/** 卡片左上角的勾选框；已邀请的显示标签 */
function Pick({ id, invited, t }: { id: string; invited: boolean; t: Dict }) {
  if (invited) return <span className="chip">{t.me.invited}</span>;
  return (
    <input type="checkbox" name="invitee" value={id} aria-label={t.me.pick} className="h-4 w-4 accent-[var(--accent)]" />
  );
}

/** 推荐卡片外包一层表单：勾选后一起发邀请 */
function InviteForm({ course, t, children }: { course: string; t: Dict; children: React.ReactNode }) {
  return (
    <ActionForm action={inviteToNewGroup} className="space-y-3">
      <input type="hidden" name="course" value={course} />
      <p className="text-xs text-muted">{t.me.selectHint}</p>
      {children}
      <SubmitButton pending={t.me.sendingInvites} variant="ghost">
        {t.me.sendInvites}
      </SubmitButton>
    </ActionForm>
  );
}

function Stars({ rating, t }: { rating?: Rating; t: Dict }) {
  if (!rating) return null;
  return (
    <span className="text-xs text-amber-600" title={t.me.ratingTitle(rating.count)}>
      ★ {rating.avg.toFixed(1)}
    </span>
  );
}

function GroupButton({ course, mode, size, t }: { course: string; mode: MatchMode; size: number; t: Dict }) {
  return (
    <form action={formGroup}>
      <input type="hidden" name="course" value={course} />
      <input type="hidden" name="mode" value={mode} />
      <SubmitButton pending={geminiEnabled ? t.me.formingAi : t.me.forming}>
        {geminiEnabled ? t.me.formGroupAi(size) : t.me.formGroup(size)}
      </SubmitButton>
    </form>
  );
}

function SimilarCourse({ me, all, course, ratings, t, invitedIds, tr }: Ctx) {
  const matches = recommend(me, all, course, ratings);
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold">{tr(course)}</h2>
        <span className="text-sm text-muted">{t.me.recommended(matches.length)}</span>
        {matches.length > 0 && (
          <div className="ml-auto">
            <GroupButton course={course} mode="similar" size={me.groupSize} t={t} />
          </div>
        )}
      </div>
      {matches.length === 0 ? (
        <p className="card text-sm text-muted">{t.me.noClassmates}</p>
      ) : (
        <InviteForm course={course} t={t}>
        <div className="grid gap-3 sm:grid-cols-2">
          {matches.map((m) => (
            <label key={m.student.id} className="card space-y-2 cursor-pointer has-[:checked]:border-accent">
              <div className="flex items-start justify-between gap-2">
                <span className="flex items-center gap-2 font-medium">
                  <Pick id={m.student.id} invited={invitedIds.has(m.student.id)} t={t} />
                  {m.student.name} <Stars rating={ratings.get(m.student.id)} t={t} />
                </span>
                <Score score={m.score} t={t} />
              </div>
              {m.student.aiSummary && <p className="text-xs text-muted">{tr(m.student.aiSummary)}</p>}
              <ul className="space-y-0.5 text-sm">
                {m.reasons.map((r) => (
                  <li key={r.kind}>· {reasonText(t, r)}</li>
                ))}
              </ul>
            </label>
          ))}
        </div>
        </InviteForm>
      )}
    </section>
  );
}

async function ComplementCourse({ me, all, course, ratings, t, locale, invitedIds, tr }: Ctx) {
  const db = await getDb();
  const [cached] = await db
    .select()
    .from(complements)
    .where(and(eq(complements.studentId, me.id), eq(complements.course, course)));
  const pool = complementPool(me, all, course);
  const byId = new Map(all.map((s) => [s.id, s]));
  const picks = (cached?.picks ?? []).filter((p) => byId.has(p.id));
  const trReason = await getTranslator(
    picks.map((p) => p.reason),
    locale,
  );

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold">{tr(course)}</h2>
        <span className="text-sm text-muted">{t.me.available(pool.length)}</span>
        {pool.length > 0 && (
          <div className="ml-auto flex flex-wrap gap-2">
            <form action={findComplements}>
              <input type="hidden" name="course" value={course} />
              <SubmitButton pending={t.me.analyzing} variant={cached ? "ghost" : "primary"}>
                {cached ? t.me.reanalyze : geminiEnabled ? t.me.findComplementAi : t.me.findComplement}
              </SubmitButton>
            </form>
            {cached && <GroupButton course={course} mode="complement" size={me.groupSize} t={t} />}
          </div>
        )}
      </div>
      {pool.length === 0 ? (
        <p className="card text-sm text-muted">{t.me.noTimeMatch}</p>
      ) : !cached ? (
        <p className="card text-sm text-muted">{me.strong || me.weak ? t.me.complementPrompt : t.me.complementFillProfile}</p>
      ) : (
        <InviteForm course={course} t={t}>
        <div className="grid gap-3 sm:grid-cols-2">
          {picks.map((p) => {
            const s = byId.get(p.id)!;
            return (
              <label key={p.id} className="card space-y-2 cursor-pointer has-[:checked]:border-accent">
                <div className="flex items-start justify-between gap-2">
                  <span className="flex items-center gap-2 font-medium">
                    <Pick id={s.id} invited={invitedIds.has(s.id)} t={t} />
                    {s.name} <Stars rating={ratings.get(s.id)} t={t} />
                  </span>
                  <Score score={p.score} t={t} />
                </div>
                <p className="text-sm">{trReason(p.reason)}</p>
                <div className="text-xs text-muted space-y-0.5">
                  {s.strong && <div>{t.me.strong}{tr(s.strong)}</div>}
                  {s.weak && <div>{t.me.weak}{tr(s.weak)}</div>}
                </div>
              </label>
            );
          })}
        </div>
        </InviteForm>
      )}
      {cached && <p className="text-xs text-muted">{t.me.analyzedAt(cached.byAi, formatDateTime(locale, cached.createdAt))}</p>}
    </section>
  );
}

function ReceivedInvites({
  invites: list,
  groupById,
  nameOf,
  t,
  locale,
  tr,
}: {
  invites: Invite[];
  groupById: Map<string, Group>;
  nameOf: (id: string) => string;
  t: Dict;
  locale: Locale;
  tr: Translate;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{t.me.invitesTitle}</h2>
      {list.map((i) => {
        const g = groupById.get(i.groupId)!;
        return (
          <div key={i.id} className="card flex flex-wrap items-center gap-3 border-accent">
            <div className="flex-1 min-w-56">
              <div className="font-medium">{t.me.inviteFrom(nameOf(i.inviterId), tr(g.course))}</div>
              <div className="text-sm text-muted">
                {tr(g.name)} · {t.me.groupMeta(g.memberIds.length, slotList(t, g.meetingSlots.slice(0, 3)) || t.group.noCommonSlots)}
              </div>
            </div>
            <Link href={localePath(locale, `/groups/${g.id}`)} className="btn-ghost">{t.me.viewGroup}</Link>
            <form action={respondInvite}>
              <input type="hidden" name="inviteId" value={i.id} />
              <input type="hidden" name="decision" value="decline" />
              <button className="btn-ghost">{t.me.decline}</button>
            </form>
            <form action={respondInvite}>
              <input type="hidden" name="inviteId" value={i.id} />
              <input type="hidden" name="decision" value="accept" />
              <button className="btn">{t.me.accept}</button>
            </form>
          </div>
        );
      })}
    </section>
  );
}

async function Dashboard({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const [{ locale, t }, { mode: modeParam }, sid] = await Promise.all([getI18n(), searchParams, currentStudentId()]);
  const mode: MatchMode = modeParam === "complement" ? "complement" : "similar";
  const to = (path: string) => localePath(locale, path);
  if (!sid) redirect(to("/login?next=/me"));
  const db = await getDb();
  const [all, allGroups, ratings, pendingInvites] = await Promise.all([
    db.select().from(students).then((list) => localizeNames(list, locale)),
    db.select().from(groups),
    getRatings(),
    db.select().from(invites).where(eq(invites.status, "pending")),
  ]);
  const me = all.find((s) => s.id === sid);
  if (!me) redirect(to("/join"));

  const myGroups = allGroups
    .filter((g) => g.memberIds.includes(me.id))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const myRating = ratings.get(me.id);
  const groupById = new Map(allGroups.map((g) => [g.id, g]));
  const nameOf = (id: string) => all.find((s) => s.id === id)?.name ?? t.common.left;
  const received = pendingInvites.filter((i) => i.inviteeId === me.id && groupById.has(i.groupId));
  const sent = pendingInvites.filter((i) => i.inviterId === me.id && groupById.has(i.groupId));
  // 页面上会出现的用户内容/AI 内容，统一换成当前语言
  const shownGroups = allGroups.filter(
    (g) => myGroups.includes(g) || received.some((i) => i.groupId === g.id) || sent.some((i) => i.groupId === g.id),
  );
  const classmates = all.filter((s) => s.courses.some((c) => me.courses.includes(c)));
  const tr = await getTranslator(
    [
      ...me.courses,
      ...shownGroups.flatMap((g) => [g.name, g.course]),
      ...classmates.flatMap((s) => [s.aiSummary, s.strong, s.weak]),
    ],
    locale,
  );
  const invitedFor = (course: string) =>
    new Set(sent.filter((i) => groupById.get(i.groupId)?.course === course).map((i) => i.inviteeId));

  const tab = (m: MatchMode, label: string, hint: string) => (
    <Link
      href={to(m === "similar" ? "/me" : "/me?mode=complement")}
      className={`flex-1 rounded-xl px-4 py-2 text-center text-sm ${mode === m ? "bg-surface shadow-sm font-medium" : "text-muted hover:text-fg"}`}
    >
      {label}
      <span className="block text-xs font-normal text-muted">{hint}</span>
    </Link>
  );

  const o = t.options;
  return (
    <div className="space-y-8">
      <section className="card flex flex-wrap items-start gap-4">
        <div className="flex-1 min-w-60">
          <h1 className="text-xl font-semibold">
            {t.me.hello(me.name)}
            {myRating && (
              <span className="ml-2 text-sm font-normal text-amber-600">
                {t.me.myRating(myRating.avg.toFixed(1), myRating.count)}
              </span>
            )}
          </h1>
          {me.aiSummary && (
            <p className="mt-1 text-sm text-muted">
              {t.me.aiSummary}
              {tr(me.aiSummary)}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {[o.paces[me.pace], o.modes[me.mode], o.goals[me.goal], ...me.tags.map((tag) => tagLabel(t, tag))].map((x) => (
              <span key={x} className="chip">{x}</span>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={to("/join")} className="btn-ghost">{t.me.edit}</Link>
          <form action={logout}>
            <button className="btn-ghost">{t.nav.logout}</button>
          </form>
        </div>
      </section>

      {received.length > 0 && (
        <ReceivedInvites invites={received} groupById={groupById} nameOf={nameOf} t={t} locale={locale} tr={tr} />
      )}

      {myGroups.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">{t.me.myGroups}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {myGroups.map((g) => (
              <Link key={g.id} href={to(`/groups/${g.id}`)} className="card hover:border-accent">
                <div className="text-xs text-muted">{tr(g.course)}</div>
                <div className="font-medium">{tr(g.name)}</div>
                <div className="mt-1 text-xs text-muted">
                  {t.me.groupMeta(g.memberIds.length, slotList(t, g.meetingSlots.slice(0, 3)))}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="flex gap-1 rounded-2xl bg-accent-soft p-1">
        {tab("similar", t.me.similar, t.me.similarHint)}
        {tab("complement", t.me.complement, t.me.complementHint)}
      </div>
      <p className="-mt-4 text-xs text-muted">ⓘ {t.me.scoreHelp}</p>

      {me.courses.map((course) => {
        const ctx = { me, all, course, ratings, t, locale, invitedIds: invitedFor(course), tr };
        return mode === "similar" ? <SimilarCourse key={course} {...ctx} /> : <ComplementCourse key={course} {...ctx} />;
      })}

      {sent.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted">{t.me.sentTitle}</h2>
          <ul className="space-y-1 text-sm text-muted">
            {sent.map((i) => (
              <li key={i.id}>
                <Link href={to(`/groups/${i.groupId}`)} className="hover:text-accent">
                  · {t.me.sentItem(nameOf(i.inviteeId), tr(groupById.get(i.groupId)!.name))}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!geminiEnabled && <p className="text-xs text-muted">{t.common.noGemini}</p>}
    </div>
  );
}

export default async function MePage({ searchParams }: PageProps<"/[lang]/me">) {
  const { t } = await getI18n();
  return (
    <Suspense fallback={<p className="text-muted">{t.me.loadingMatches}</p>}>
      <Dashboard searchParams={searchParams as Promise<{ mode?: string }>} />
    </Suspense>
  );
}
