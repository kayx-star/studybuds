"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { requireMember } from "@/db/queries";
import { codeFiles, students } from "@/db/schema";
import { localePath } from "@/i18n/config";
import { displayName } from "@/i18n/names";
import { getActionI18n } from "@/i18n/server";
import { FILE_NAME_RE, MAX_CODE_BYTES, starterCode } from "@/lib/code";
import type { FormState } from "./group-actions";

export async function createFile(_prev: FormState, formData: FormData): Promise<FormState> {
  const { locale, t } = await getActionI18n();
  const ctx = await requireMember(String(formData.get("groupId")));
  if (!ctx) return { error: t.errors.notMember };
  const name = String(formData.get("name") ?? "").trim();
  if (!FILE_NAME_RE.test(name)) return { error: t.code.errors.badName };

  const [exists] = await ctx.db
    .select({ id: codeFiles.id })
    .from(codeFiles)
    .where(and(eq(codeFiles.groupId, ctx.group.id), eq(codeFiles.name, name)));
  if (exists) return { error: t.code.errors.exists };

  const id = crypto.randomUUID();
  await ctx.db.insert(codeFiles).values({
    id,
    groupId: ctx.group.id,
    name,
    content: starterCode(name),
    version: 1,
    updatedBy: ctx.me.id,
    updatedAt: new Date(),
  });
  redirect(localePath(locale, `/groups/${ctx.group.id}/code/${id}`));
}

export type SaveResult =
  | { ok: true; version: number }
  | { ok: false; error: string }
  | { ok: false; conflict: true; version: number; content: string; by: string };

/**
 * 保存文件（乐观锁）：只有当数据库里的版本仍是 baseVersion 时才写入，
 * 否则返回最新内容让用户选择；force=true 时强制覆盖。
 */
export async function saveFile(input: {
  groupId: string;
  fileId: string;
  content: string;
  baseVersion: number;
  force?: boolean;
}): Promise<SaveResult> {
  const { locale, t } = await getActionI18n();
  const ctx = await requireMember(input.groupId);
  if (!ctx) return { ok: false, error: t.errors.notMember };
  if (new TextEncoder().encode(input.content).length > MAX_CODE_BYTES) return { ok: false, error: t.code.errors.tooBig };

  const where = and(eq(codeFiles.id, input.fileId), eq(codeFiles.groupId, ctx.group.id));
  const [file] = await ctx.db.select().from(codeFiles).where(where);
  if (!file) return { ok: false, error: t.errors.notMember };

  if (file.version !== input.baseVersion && !input.force) {
    const [by] = await ctx.db.select({ name: students.name }).from(students).where(eq(students.id, file.updatedBy));
    const name = by ? displayName(by.name, locale) : "";
    return { ok: false, conflict: true, version: file.version, content: file.content, by: name };
  }

  // 条件更新：防止两次保存同时通过上面的检查
  const version = file.version + 1;
  const updated = await ctx.db
    .update(codeFiles)
    .set({ content: input.content, version, updatedBy: ctx.me.id, updatedAt: new Date() })
    .where(and(where, eq(codeFiles.version, file.version)))
    .returning({ version: codeFiles.version });
  if (updated.length === 0) return saveFile(input);
  return { ok: true, version };
}
