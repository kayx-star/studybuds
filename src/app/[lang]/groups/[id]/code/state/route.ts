import { and, eq } from "drizzle-orm";
import { requireMember } from "@/db/queries";
import { codeFiles, students } from "@/db/schema";
import { isLocale } from "@/i18n/config";
import { displayName } from "@/i18n/names";

/** Polled by the editor: returns the file's current version, and its content when newer than `since` */
export async function GET(req: Request, ctx: RouteContext<"/[lang]/groups/[id]/code/state">) {
  const { id, lang } = await ctx.params;
  const member = await requireMember(id);
  if (!member) return Response.json({ error: "forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const fileId = url.searchParams.get("file") ?? "";
  const since = Number(url.searchParams.get("since") ?? 0);
  const [file] = await member.db
    .select()
    .from(codeFiles)
    .where(and(eq(codeFiles.id, fileId), eq(codeFiles.groupId, id)));
  if (!file) return Response.json({ error: "not found" }, { status: 404 });

  const [by] = await member.db.select({ name: students.name }).from(students).where(eq(students.id, file.updatedBy));
  return Response.json({
    version: file.version,
    by: by ? displayName(by.name, isLocale(lang) ? lang : "zh") : "",
    byMe: file.updatedBy === member.me.id,
    content: file.version > since ? file.content : undefined,
  });
}
