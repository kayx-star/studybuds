import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { findComplements, formGroup } from "@/app/actions";
import { logout } from "@/app/auth-actions";
import { SubmitButton } from "@/components/submit-button";
import { getDb } from "@/db";
import { getRatings } from "@/db/queries";
import { complements, groups, students, type Student } from "@/db/schema";
import { localePath, type Locale } from "@/i18n/config";
import { formatDateTime, reasonText, slotList, tagLabel } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import type { Dict } from "@/i18n/zh";
import { geminiEnabled } from "@/lib/gemini";
import { complementPool, recommend, type MatchMode } from "@/lib/match";
import type { Rating } from "@/lib/ratings";
import { currentStudentId } from "@/lib/session";

type Ctx = { me: Student; all: Student[]; course: string; ratings: Map<string, Rating>; t: Dict; locale: Locale };

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

function SimilarCourse({ me, all, course, ratings, t }: Ctx) {
  const matches = recommend(me, all, course, ratings);
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold">{course}</h2>
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
        <div className="grid gap-3 sm:grid-cols-2">
          {matches.map((m) => (
            <div key={m.student.id} className="card space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">
                  {m.student.name} <Stars rating={ratings.get(m.student.id)} t={t} />
                </span>
                <span className="text-lg font-semibold text-accent">{m.score}</span>
              </div>
              {m.student.aiSummary && <p className="text-xs text-muted">{m.student.aiSummary}</p>}
              <ul className="space-y-0.5 text-sm">
                {m.reasons.map((r) => (
                  <li key={r.kind}>· {reasonText(t, r)}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

async function ComplementCourse({ me, all, course, ratings, t, locale }: Ctx) {
  const db = await getDb();
  const [cached] = await db
    .select()
    .from(complements)
    .where(and(eq(complements.studentId, me.id), eq(complements.course, course)));
  const pool = complementPool(me, all, course);
  const byId = new Map(all.map((s) => [s.id, s]));
  const picks = (cached?.picks ?? []).filter((p) => byId.has(p.id));

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold">{course}</h2>
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
        <div className="grid gap-3 sm:grid-cols-2">
          {picks.map((p) => {
            const s = byId.get(p.id)!;
            return (
              <div key={p.id} className="card space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">
                    {s.name} <Stars rating={ratings.get(s.id)} t={t} />
                  </span>
                  <span className="text-lg font-semibold text-accent">{p.score}</span>
                </div>
                <p className="text-sm">{p.reason}</p>
                <div className="text-xs text-muted space-y-0.5">
                  {s.strong && <div>{t.me.strong}{s.strong}</div>}
                  {s.weak && <div>{t.me.weak}{s.weak}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {cached && <p className="text-xs text-muted">{t.me.analyzedAt(cached.byAi, formatDateTime(locale, cached.createdAt))}</p>}
    </section>
  );
}

async function Dashboard({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const [{ locale, t }, { mode: modeParam }, sid] = await Promise.all([getI18n(), searchParams, currentStudentId()]);
  const mode: MatchMode = modeParam === "complement" ? "complement" : "similar";
  const to = (path: string) => localePath(locale, path);
  if (!sid) redirect(to("/login?next=/me"));
  const db = await getDb();
  const [all, allGroups, ratings] = await Promise.all([
    db.select().from(students),
    db.select().from(groups),
    getRatings(),
  ]);
  const me = all.find((s) => s.id === sid);
  if (!me) redirect(to("/join"));

  const myGroups = allGroups
    .filter((g) => g.memberIds.includes(me.id))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const myRating = ratings.get(me.id);

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
              {me.aiSummary}
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

      {myGroups.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">{t.me.myGroups}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {myGroups.map((g) => (
              <Link key={g.id} href={to(`/groups/${g.id}`)} className="card hover:border-accent">
                <div className="text-xs text-muted">{g.course}</div>
                <div className="font-medium">{g.name}</div>
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

      {me.courses.map((course) => {
        const ctx = { me, all, course, ratings, t, locale };
        return mode === "similar" ? <SimilarCourse key={course} {...ctx} /> : <ComplementCourse key={course} {...ctx} />;
      })}

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
