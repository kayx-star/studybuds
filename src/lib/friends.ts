import "server-only";
import { and, eq, or } from "drizzle-orm";
import { getDb } from "@/db";
import { friendships } from "@/db/schema";

/** The friendship row between two people (either direction) */
export const friendPair = (a: string, b: string) =>
  or(
    and(eq(friendships.requesterId, a), eq(friendships.addresseeId, b)),
    and(eq(friendships.requesterId, b), eq(friendships.addresseeId, a)),
  );

export async function areFriends(a: string, b: string) {
  const db = await getDb();
  const [row] = await db
    .select({ status: friendships.status })
    .from(friendships)
    .where(and(friendPair(a, b), eq(friendships.status, "accepted")));
  return !!row;
}
