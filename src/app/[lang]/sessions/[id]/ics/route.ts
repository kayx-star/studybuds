import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { requireMember } from "@/db/queries";
import { studySessions } from "@/db/schema";
import { isLocale } from "@/i18n/config";
import { dictFor } from "@/i18n/dicts";
import { toIcs } from "@/lib/schedule";
import { getTranslator } from "@/lib/translate";

export async function GET(_req: Request, ctx: RouteContext<"/[lang]/sessions/[id]/ics">) {
  const { id, lang } = await ctx.params;
  const locale = isLocale(lang) ? lang : "zh";
  const t = dictFor(locale);
  const db = await getDb();
  const [session] = await db.select().from(studySessions).where(eq(studySessions.id, id));
  const member = session ? await requireMember(session.groupId) : null;
  if (!session || !member) return new Response("Not found", { status: 404 });

  const tr = await getTranslator([member.group.course, session.topic, session.place], locale);
  const ics = toIcs({
    id: session.id,
    date: session.date,
    start: session.start,
    minutes: session.minutes,
    title: t.sessions.icsTitle(tr(member.group.course), tr(session.topic)),
    place: tr(session.place),
    reminder: t.sessions.icsReminder,
  });
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="study-${session.date}.ics"`,
    },
  });
}
