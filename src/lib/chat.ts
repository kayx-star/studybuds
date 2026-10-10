import "server-only";
import { and, eq, or } from "drizzle-orm";
import { getDb } from "@/db";
import { groups, messages, students } from "@/db/schema";

/** 两人之间的全部消息条件 */
export const pairWhere = (a: string, b: string) =>
  or(
    and(eq(messages.senderId, a), eq(messages.recipientId, b)),
    and(eq(messages.senderId, b), eq(messages.recipientId, a)),
  );

/** 能否私信：同课程、同小组，或对方先给你发过消息 */
export async function canMessage(meId: string, otherId: string) {
  if (meId === otherId) return false;
  const db = await getDb();
  const [me, other] = await Promise.all([
    db.select({ courses: students.courses }).from(students).where(eq(students.id, meId)),
    db.select({ courses: students.courses }).from(students).where(eq(students.id, otherId)),
  ]);
  if (!me[0] || !other[0]) return false;
  if (me[0].courses.some((c) => other[0].courses.includes(c))) return true;

  const allGroups = await db.select({ memberIds: groups.memberIds }).from(groups);
  if (allGroups.some((g) => g.memberIds.includes(meId) && g.memberIds.includes(otherId))) return true;

  const [incoming] = await db
    .select({ id: messages.id })
    .from(messages)
    .where(and(eq(messages.senderId, otherId), eq(messages.recipientId, meId)))
    .limit(1);
  return !!incoming;
}
