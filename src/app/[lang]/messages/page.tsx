import { desc, eq, or } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getDb } from "@/db";
import { messages, students } from "@/db/schema";
import { localePath } from "@/i18n/config";
import { formatDateTime } from "@/i18n/format";
import { displayName } from "@/i18n/names";
import { getI18n } from "@/i18n/server";
import { currentStudentId } from "@/lib/session";

async function Conversations() {
  const [{ locale, t }, sid] = await Promise.all([getI18n(), currentStudentId()]);
  if (!sid) redirect(localePath(locale, "/login?next=/messages"));
  const db = await getDb();
  const [rows, all] = await Promise.all([
    db
      .select()
      .from(messages)
      .where(or(eq(messages.senderId, sid), eq(messages.recipientId, sid)))
      .orderBy(desc(messages.createdAt)),
    db.select({ id: students.id, name: students.name }).from(students),
  ]);

  // Group by the other person: latest message plus unread count
  const threads = new Map<string, { last: (typeof rows)[number]; unread: number }>();
  for (const m of rows) {
    const other = m.senderId === sid ? m.recipientId : m.senderId;
    const th = threads.get(other) ?? { last: m, unread: 0 };
    if (m.recipientId === sid && !m.readAt) th.unread++;
    threads.set(other, th);
  }
  const nameOf = (id: string) => displayName(all.find((s) => s.id === id)?.name ?? t.common.left, locale);

  if (threads.size === 0) return <p className="card text-sm text-muted">{t.chat.empty}</p>;
  return (
    <ul className="card divide-y divide-line !p-0">
      {[...threads].map(([other, { last, unread }]) => (
        <li key={other}>
          <Link href={localePath(locale, `/messages/${other}`)} className="flex items-center gap-3 px-4 py-3 hover:bg-accent-soft/50">
            <div className="flex-1 min-w-0">
              <div className="font-medium">{nameOf(other)}</div>
              <div className="truncate text-sm text-muted">
                {last.senderId === sid && t.chat.you}
                {last.body}
              </div>
            </div>
            <div className="shrink-0 text-right text-xs text-muted">
              <div>{formatDateTime(locale, last.createdAt)}</div>
              {unread > 0 && (
                <span className="mt-1 inline-block rounded-full bg-red-500 px-1.5 text-white">{t.chat.unread(unread)}</span>
              )}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function MessagesPage() {
  const { t } = await getI18n();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t.chat.title}</h1>
      <Suspense fallback={<p className="text-muted">{t.common.loading}</p>}>
        <Conversations />
      </Suspense>
    </div>
  );
}
