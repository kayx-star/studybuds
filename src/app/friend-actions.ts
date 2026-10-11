"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { friendships, students } from "@/db/schema";
import { friendPair } from "@/lib/friends";
import { currentStudentId } from "@/lib/session";

/** Sends a friend request; if they already requested me, we become friends right away */
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

/** Accepts or declines a request sent to me; declining deletes it so they can ask again later */
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

/** Cancels my outgoing request, or removes a friend */
export async function removeFriend(formData: FormData) {
  const sid = await currentStudentId();
  const other = String(formData.get("id") ?? "");
  if (!sid || !other) return;
  const db = await getDb();
  await db.delete(friendships).where(friendPair(sid, other));
  revalidatePath("/[lang]/friends", "page");
}
