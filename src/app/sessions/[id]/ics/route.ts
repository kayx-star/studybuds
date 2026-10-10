import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { requireMember } from "@/db/queries";
import { studySessions } from "@/db/schema";
import { toIcs } from "@/lib/schedule";

export async function GET(_req: Request, ctx: RouteContext<"/sessions/[id]/ics">) {
  const { id } = await ctx.params;
  const db = await getDb();
  const [session] = await db.select().from(studySessions).where(eq(studySessions.id, id));
  const member = session ? await requireMember(session.groupId) : null;
  if (!session || !member) return new Response("Not found", { status: 404 });

  const ics = toIcs({
    id: session.id,
    date: session.date,
    start: session.start,
    minutes: session.minutes,
    title: `${member.group.course} 自习${session.topic ? "：" + session.topic : ""}`,
    place: session.place,
  });
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="study-${session.date}.ics"`,
    },
  });
}
