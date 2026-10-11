import "server-only";
import { eq } from "drizzle-orm";
import { currentStudentId } from "@/lib/session";
import { summarizeRatings } from "@/lib/ratings";
import { getDb } from ".";
import { groups, reviews, students } from "./schema";

export async function getRatings() {
  const db = await getDb();
  return summarizeRatings(await db.select().from(reviews));
}

/** Returns null unless the logged-in student is a member of the group */
export async function requireMember(groupId: string) {
  const sid = await currentStudentId();
  if (!sid) return null;
  const db = await getDb();
  const [group] = await db.select().from(groups).where(eq(groups.id, groupId));
  if (!group || !group.memberIds.includes(sid)) return null;
  const [me] = await db.select().from(students).where(eq(students.id, sid));
  return me ? { db, group, me } : null;
}
