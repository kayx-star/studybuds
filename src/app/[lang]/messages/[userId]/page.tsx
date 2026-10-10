import { and, asc, eq, isNull } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ChatThread } from "@/components/chat-thread";
import { getDb } from "@/db";
import { messages, students } from "@/db/schema";
import { HTML_LANG, localePath } from "@/i18n/config";
import { displayName } from "@/i18n/names";
import { getI18n } from "@/i18n/server";
import { canMessage, pairWhere } from "@/lib/chat";
import { currentStudentId } from "@/lib/session";

async function Thread({ params }: { params: Promise<{ userId: string }> }) {
  await connection(); // 下面标记已读会写入当前时间
  const [{ userId }, { locale, t }, sid] = await Promise.all([params, getI18n(), currentStudentId()]);
  if (!sid) redirect(localePath(locale, `/login?next=/messages/${userId}`));
  const db = await getDb();
  const [other] = await db.select().from(students).where(eq(students.id, userId));
  if (!other || !(await canMessage(sid, userId))) notFound();

  const rows = await db.select().from(messages).where(pairWhere(sid, userId)).orderBy(asc(messages.createdAt));
  // 打开对话即标记已读
  await db
    .update(messages)
    .set({ readAt: new Date() })
    .where(and(eq(messages.senderId, userId), eq(messages.recipientId, sid), isNull(messages.readAt)));

  const name = displayName(other.name, locale);
  const c = t.chat;
  return (
    <div className="space-y-4">
      <Link href={localePath(locale, "/messages")} className="text-sm text-muted hover:text-fg">{c.back}</Link>
      <h1 className="text-xl font-semibold">{name}</h1>
      <ChatThread
        otherId={userId}
        initial={rows.map((m) => ({ id: m.id, mine: m.senderId === sid, body: m.body, at: m.createdAt.getTime() }))}
        pollUrl={localePath(locale, `/messages/${userId}/poll`)}
        l={{
          placeholder: c.placeholder,
          send: c.send,
          sending: c.sending,
          translate: c.translate,
          showOriginal: c.showOriginal,
          translating: c.translating,
          empty: c.noMessages(name),
          htmlLang: HTML_LANG[locale],
          emoji: c.emoji,
        }}
      />
    </div>
  );
}

export default async function ThreadPage({ params }: PageProps<"/[lang]/messages/[userId]">) {
  const { t } = await getI18n();
  return (
    <Suspense fallback={<p className="text-muted">{t.common.loading}</p>}>
      <Thread params={params} />
    </Suspense>
  );
}
