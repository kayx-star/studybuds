import "server-only";
import { and, eq, or } from "drizzle-orm";
import { getDb } from "@/db";
import { groups, messages, students } from "@/db/schema";
import { areFriends } from "./friends";

/** Condition matching all messages between two people */
export const pairWhere = (a: string, b: string) =>
  or(
    and(eq(messages.senderId, a), eq(messages.recipientId, b)),
    and(eq(messages.senderId, b), eq(messages.recipientId, a)),
  );

/** Can message: friends, same subject, same group, or they messaged you first */
export async function canMessage(meId: string, otherId: string) {
  if (meId === otherId) return false;
  const db = await getDb();
  const [me, other] = await Promise.all([
    db.select({ courses: students.courses }).from(students).where(eq(students.id, meId)),
    db.select({ courses: students.courses }).from(students).where(eq(students.id, otherId)),
  ]);
  if (!me[0] || !other[0]) return false;
  if (me[0].courses.some((c) => other[0].courses.includes(c))) return true;
  if (await areFriends(meId, otherId)) return true;

  const allGroups = await db.select({ memberIds: groups.memberIds }).from(groups);
  if (allGroups.some((g) => g.memberIds.includes(meId) && g.memberIds.includes(otherId))) return true;

  const [incoming] = await db
    .select({ id: messages.id })
    .from(messages)
    .where(and(eq(messages.senderId, otherId), eq(messages.recipientId, meId)))
    .limit(1);
  return !!incoming;
}
