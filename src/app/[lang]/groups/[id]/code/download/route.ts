import { eq } from "drizzle-orm";
import { strToU8, zipSync } from "fflate";
import { requireMember } from "@/db/queries";
import { codeFiles } from "@/db/schema";
import { isLocale } from "@/i18n/config";
import { dictFor } from "@/i18n/dicts";
import { getTranslator } from "@/lib/translate";

/** Packages the group's code as a VS Code project: sources in src/, plus Java extension recommendations and a README */
export async function GET(_req: Request, ctx: RouteContext<"/[lang]/groups/[id]/code/download">) {
  const { id, lang } = await ctx.params;
  const member = await requireMember(id);
  if (!member) return new Response("Forbidden", { status: 403 });
  const locale = isLocale(lang) ? lang : "zh";
  const t = dictFor(locale);
  const tr = await getTranslator([member.group.name], locale);

  const files = await member.db.select().from(codeFiles).where(eq(codeFiles.groupId, id));
  const entries: Record<string, Uint8Array> = {
    "README.md": strToU8(t.code.readme(tr(member.group.name))),
    ".vscode/extensions.json": strToU8(JSON.stringify({ recommendations: ["vscjava.vscode-java-pack"] }, null, 2)),
    ".vscode/settings.json": strToU8(JSON.stringify({ "java.project.sourcePaths": ["src"] }, null, 2)),
  };
  for (const f of files) entries[`src/${f.name}`] = strToU8(f.content);

  const zip = zipSync(entries);
  return new Response(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="study-group-code.zip"`,
    },
  });
}
