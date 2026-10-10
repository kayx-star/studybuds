import { eq, or } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { removeFriend, respondFriendRequest, sendFriendRequest } from "@/app/friend-actions";
import { SubmitButton } from "@/components/submit-button";
import { getDb } from "@/db";
import { friendships, students, users, type Friendship, type Student } from "@/db/schema";
import { localePath, type Locale } from "@/i18n/config";
import { campusLabel } from "@/i18n/format";
import { displayName } from "@/i18n/names";
import { getI18n } from "@/i18n/server";
import type { Dict } from "@/i18n/zh";
import { currentStudentId } from "@/lib/session";
import { subjectLabel } from "@/lib/subjects";

type Relation = "none" | "friend" | "outgoing" | "incoming";

/** 一个同学的卡片：昵称、课程、校区 + 按关系显示的按钮 */
function PersonRow({
  s,
  relation,
  t,
  locale,
}: {
  s: Student;
  relation: Relation;
  t: Dict;
  locale: Locale;
}) {
  const f = t.friends;
  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <div className="flex-1 min-w-48">
        <div className="font-medium">{displayName(s.name, locale)}</div>
        <div className="text-xs text-muted">
          {f.courses}
          {t.list(s.courses.map((c) => subjectLabel(c, locale)))}
          {s.campus && ` · ${campusLabel(t, s.campus)}`}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {relation === "none" && (
          <form action={sendFriendRequest}>
            <input type="hidden" name="id" value={s.id} />
            <SubmitButton pending="…">{f.add}</SubmitButton>
          </form>
        )}
        {relation === "incoming" && (
          <>
            <form action={respondFriendRequest}>
              <input type="hidden" name="id" value={s.id} />
              <input type="hidden" name="decision" value="decline" />
              <SubmitButton pending="…" variant="ghost">{f.decline}</SubmitButton>
            </form>
            <form action={respondFriendRequest}>
              <input type="hidden" name="id" value={s.id} />
              <input type="hidden" name="decision" value="accept" />
              <SubmitButton pending="…">{f.accept}</SubmitButton>
            </form>
          </>
        )}
        {relation === "outgoing" && (
          <>
            <span className="chip self-center">{f.requested}</span>
            <form action={removeFriend}>
              <input type="hidden" name="id" value={s.id} />
              <SubmitButton pending="…" variant="ghost">{f.cancel}</SubmitButton>
            </form>
          </>
        )}
        {relation === "friend" && (
          <>
            <Link href={localePath(locale, `/messages/${s.id}`)} className="btn-ghost">{t.chat.message}</Link>
            {/* 删除前用展开确认，不依赖浏览器弹窗 */}
            <details className="relative">
              <summary className="btn-ghost cursor-pointer list-none text-red-600">{f.remove}</summary>
              <form action={removeFriend} className="absolute right-0 z-10 mt-1 flex items-center gap-2 rounded-xl border border-line bg-surface p-2 shadow">
                <input type="hidden" name="id" value={s.id} />
                <span className="whitespace-nowrap text-sm">{f.removeConfirm}</span>
                <SubmitButton pending="…">{f.remove}</SubmitButton>
              </form>
            </details>
          </>
        )}
      </div>
    </li>
  );
}

async function FriendsContent({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const [{ q = "" }, { locale, t }, sid] = await Promise.all([searchParams, getI18n(), currentStudentId()]);
  if (!sid) redirect(localePath(locale, "/login?next=/friends"));
  const f = t.friends;
  const db = await getDb();
  const [all, rows] = await Promise.all([
    db.select().from(students),
    db
      .select()
      .from(friendships)
      .where(or(eq(friendships.requesterId, sid), eq(friendships.addresseeId, sid))),
  ]);

  const relationOf = (id: string): Relation => {
    const r = rows.find((x: Friendship) => x.requesterId === id || x.addresseeId === id);
    if (!r) return "none";
    if (r.status === "accepted") return "friend";
    return r.requesterId === sid ? "outgoing" : "incoming";
  };
  const byId = new Map(all.map((s) => [s.id, s]));
  const pick = (rel: Relation) =>
    rows
      .map((r) => (r.requesterId === sid ? r.addresseeId : r.requesterId))
      .filter((id) => relationOf(id) === rel)
      .map((id) => byId.get(id))
      .filter((s): s is Student => !!s);
  const friends = pick("friend");
  const incoming = pick("incoming");
  const outgoing = pick("outgoing");

  // 搜索：昵称（含拼音）部分匹配，或完整邮箱精确匹配；结果不显示邮箱
  const query = q.trim().toLowerCase();
  let results: Student[] = [];
  if (query) {
    const [byEmail] = query.includes("@")
      ? await db.select({ id: users.id }).from(users).where(eq(users.email, query))
      : [];
    results = all
      .filter(
        (s) =>
          s.id !== sid &&
          (s.id === byEmail?.id ||
            s.name.toLowerCase().includes(query) ||
            displayName(s.name, "en").toLowerCase().includes(query)),
      )
      .slice(0, 20);
  }

  const row = (s: Student) => <PersonRow key={s.id} s={s} relation={relationOf(s.id)} t={t} locale={locale} />;

  return (
    <div className="space-y-6">
      <form method="get" className="card space-y-2">
        <div className="flex gap-2">
          <input name="q" defaultValue={q} className="input flex-1" placeholder={f.searchPlaceholder} />
          <button className="btn">{f.search}</button>
        </div>
        <p className="text-xs text-muted">{f.searchHint}</p>
      </form>

      {query && (
        <section className="card !py-2">
          <h2 className="pt-2 text-sm font-semibold text-muted">{f.results}</h2>
          {results.length === 0 ? (
            <p className="py-3 text-sm text-muted">{f.noResults(q.trim())}</p>
          ) : (
            <ul className="divide-y divide-line">{results.map(row)}</ul>
          )}
        </section>
      )}

      {incoming.length > 0 && (
        <section className="card !py-2 border-accent">
          <h2 className="pt-2 font-semibold">{f.incomingTitle}</h2>
          <ul className="divide-y divide-line">{incoming.map(row)}</ul>
        </section>
      )}

      <section className="card !py-2">
        <h2 className="pt-2 font-semibold">{f.listTitle(friends.length)}</h2>
        {friends.length === 0 ? (
          <p className="py-3 text-sm text-muted">{f.empty}</p>
        ) : (
          <ul className="divide-y divide-line">{friends.map(row)}</ul>
        )}
      </section>

      {outgoing.length > 0 && (
        <section className="card !py-2">
          <h2 className="pt-2 text-sm font-semibold text-muted">{f.outgoingTitle}</h2>
          <ul className="divide-y divide-line">{outgoing.map(row)}</ul>
        </section>
      )}
    </div>
  );
}

export default async function FriendsPage({ searchParams }: PageProps<"/[lang]/friends">) {
  const { t } = await getI18n();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t.friends.title}</h1>
      <Suspense fallback={<p className="text-muted">{t.common.loading}</p>}>
        <FriendsContent searchParams={searchParams as Promise<{ q?: string }>} />
      </Suspense>
    </div>
  );
}
