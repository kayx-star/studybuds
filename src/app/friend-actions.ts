"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { friendships, students } from "@/db/schema";
import { friendPair } from "@/lib/friends";
import { currentStudentId } from "@/lib/session";

/** 发好友申请；如果对方已经申请过我，直接成为好友 */
export async function sendFriendRequest(formData: FormData) {
  const sid = await currentStudentId();
  const other = String(formData.get("id") ?? "");
  if (!sid || !other || other === sid) return;
  const db = await getDb();
  const [exists] = await db.select({ id: students.id }).from(students).where(eq(students.id, other));
  if (!exists) return;

  const [row] = await db.select().from(friendships).where(friendPair(sid, other));
  if (!row) {
    await db.insert(friendships).values({
      id: crypto.randomUUID(),
      requesterId: sid,
      addresseeId: other,
      status: "pending",
      createdAt: new Date(),
    });
  } else if (row.status === "pending" && row.addresseeId === sid) {
    await db.update(friendships).set({ status: "accepted" }).where(eq(friendships.id, row.id));
  }
  revalidatePath("/[lang]/friends", "page");
}

/** 接受或拒绝别人发给我的申请；拒绝时删除记录，对方以后还能再申请 */
export async function respondFriendRequest(formData: FormData) {
  const sid = await currentStudentId();
  const requester = String(formData.get("id") ?? "");
  if (!sid) return;
  const db = await getDb();
  const where = and(
    eq(friendships.requesterId, requester),
    eq(friendships.addresseeId, sid),
    eq(friendships.status, "pending"),
  );
  if (formData.get("decision") === "accept") {
    await db.update(friendships).set({ status: "accepted" }).where(where);
  } else {
    await db.delete(friendships).where(where);
  }
  revalidatePath("/[lang]/friends", "page");
}

/** 撤回我发出的申请，或删除好友 */
export async function removeFriend(formData: FormData) {
  const sid = await currentStudentId();
  const other = String(formData.get("id") ?? "");
  if (!sid || !other) return;
  const db = await getDb();
  await db.delete(friendships).where(friendPair(sid, other));
  revalidatePath("/[lang]/friends", "page");
}
