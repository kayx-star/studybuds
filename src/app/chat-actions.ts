"use server";

import { and, eq, or } from "drizzle-orm";
import { getDb } from "@/db";
import { messages } from "@/db/schema";
import { getActionI18n } from "@/i18n/server";
import { canMessage } from "@/lib/chat";
import { currentStudentId } from "@/lib/session";
import { getTranslator } from "@/lib/translate";

export type ChatMessage = { id: string; mine: boolean; body: string; at: number };

export async function sendMessage(input: { to: string; body: string }): Promise<{ message?: ChatMessage; error?: string }> {
  const { t } = await getActionI18n();
  const sid = await currentStudentId();
  if (!sid) return { error: t.join.errors.sessionExpired };
  const body = input.body.trim();
  if (!body) return { error: t.chat.errors.empty };
  if (body.length > 2000) return { error: t.chat.errors.tooLong };
  if (!(await canMessage(sid, input.to))) return { error: t.chat.errors.notAllowed };

  const db = await getDb();
  const row = { id: crypto.randomUUID(), senderId: sid, recipientId: input.to, body, createdAt: new Date() };
  await db.insert(messages).values(row);
  return { message: { id: row.id, mine: true, body, at: row.createdAt.getTime() } };
}

/** Translates one message into the current UI language on demand (only the two participants can) */
export async function translateMessage(id: string): Promise<{ text?: string; error?: string }> {
  const { locale, t } = await getActionI18n();
  const sid = await currentStudentId();
  if (!sid) return { error: t.chat.errors.translateFailed };
  const db = await getDb();
  const [msg] = await db
    .select()
    .from(messages)
    .where(and(eq(messages.id, id), or(eq(messages.senderId, sid), eq(messages.recipientId, sid))));
  if (!msg) return { error: t.chat.errors.translateFailed };
  const tr = await getTranslator([msg.body], locale);
  const text = tr(msg.body);
  return text === msg.body ? { error: t.chat.errors.translateFailed } : { text };
}
