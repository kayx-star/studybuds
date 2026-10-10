import { and, asc, eq, gt, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { messages } from "@/db/schema";
import { pairWhere } from "@/lib/chat";
import { currentStudentId } from "@/lib/session";

/** 聊天页轮询：返回 after（毫秒）之后的新消息，并把对方发来的标为已读 */
export async function GET(req: Request, ctx: RouteContext<"/[lang]/messages/[userId]/poll">) {
  const sid = await currentStudentId();
  if (!sid) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { userId } = await ctx.params;
  const after = Number(new URL(req.url).searchParams.get("after") ?? 0);

  const db = await getDb();
  const rows = await db
    .select()
    .from(messages)
    .where(and(pairWhere(sid, userId), gt(messages.createdAt, new Date(after))))
    .orderBy(asc(messages.createdAt));
  if (rows.some((m) => m.recipientId === sid && !m.readAt)) {
    await db
      .update(messages)
      .set({ readAt: new Date() })
      .where(and(eq(messages.senderId, userId), eq(messages.recipientId, sid), isNull(messages.readAt)));
  }
  return Response.json({
    messages: rows.map((m) => ({ id: m.id, mine: m.senderId === sid, body: m.body, at: m.createdAt.getTime() })),
  });
}
