import { count } from "drizzle-orm";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { getDb } from "@/db";
import { groups, students } from "@/db/schema";
import { localePath } from "@/i18n/config";
import { getI18n } from "@/i18n/server";

async function Stats() {
  await connection();
  const { t } = await getI18n();
  const db = await getDb();
  const [[s], [g]] = await Promise.all([
    db.select({ n: count() }).from(students),
    db.select({ n: count() }).from(groups),
  ]);
  return <p className="text-sm text-muted">{t.home.stats(s.n, g.n)}</p>;
}

export default async function Home() {
  const { locale, t } = await getI18n();
  return (
    <div className="space-y-12 py-6">
      <section className="space-y-5">
        <h1 className="text-4xl font-bold leading-tight">
          {t.home.titleBefore}
          <span className="text-accent">{t.home.titleHighlight}</span>
          {t.home.titleAfter}
        </h1>
        <p className="max-w-2xl text-muted">{t.home.subtitle}</p>
        <div className="flex flex-wrap gap-3">
          <Link href={localePath(locale, "/join")} className="btn">{t.home.start}</Link>
          <Link href={localePath(locale, "/me")} className="btn-ghost">{t.home.myGroups}</Link>
        </div>
        <Suspense fallback={<p className="text-sm text-muted">&nbsp;</p>}>
          <Stats />
        </Suspense>
      </section>

      <section className="card space-y-2">
        <h2 className="font-semibold">{t.home.installTitle}</h2>
        <p className="text-sm text-muted">{t.home.installIntro}</p>
        <ul className="space-y-1 text-sm">
          <li>🍎 {t.home.installIos}</li>
          <li>🤖 {t.home.installAndroid}</li>
        </ul>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {t.home.steps.map((s, i) => (
          <div key={s.title} className="card">
            <div className="chip mb-3">{t.home.step(i + 1)}</div>
            <h3 className="font-semibold">{s.title}</h3>
            <p className="mt-1 text-sm text-muted">{s.body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
