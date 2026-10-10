import { and, asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CodeEditor } from "@/components/code-editor";
import { requireMember } from "@/db/queries";
import { codeFiles } from "@/db/schema";
import { localePath } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { getTranslator } from "@/lib/translate";

async function EditorPage({ params }: { params: Promise<{ id: string; fileId: string }> }) {
  const [{ id, fileId }, { locale, t }] = await Promise.all([params, getI18n()]);
  const ctx = await requireMember(id);
  if (!ctx) notFound(); // 代码只对组员开放
  const files = await ctx.db.select().from(codeFiles).where(eq(codeFiles.groupId, id)).orderBy(asc(codeFiles.name));
  const [file] = await ctx.db.select().from(codeFiles).where(and(eq(codeFiles.id, fileId), eq(codeFiles.groupId, id)));
  if (!file) notFound();

  const c = t.code;
  const tr = await getTranslator([ctx.group.name], locale);
  const base = localePath(locale, `/groups/${id}/code`);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href={localePath(locale, `/groups/${id}`)} className="text-sm text-muted hover:text-fg">
          {c.back(tr(ctx.group.name))}
        </Link>
        <a href={`${base}/download`} className="btn-ghost ml-auto" title={c.downloadHint}>
          {c.download}
        </a>
      </div>
      <nav className="flex flex-wrap gap-2" aria-label={c.files}>
        {files.map((f) => (
          <Link
            key={f.id}
            href={`${base}/${f.id}`}
            className={`rounded-lg border px-3 py-1 font-mono text-sm ${f.id === file.id ? "border-accent bg-accent-soft text-accent" : "border-line hover:bg-accent-soft"}`}
          >
            {f.name}
          </Link>
        ))}
      </nav>
      {/* key 让切换文件时编辑器状态重置 */}
      <CodeEditor
        key={file.id}
        groupId={id}
        fileId={file.id}
        name={file.name}
        initialContent={file.content}
        initialVersion={file.version}
        stateUrl={`${base}/state`}
        l={{
          save: c.save,
          saving: c.saving,
          saved: c.saved,
          unsaved: c.unsaved,
          shortcut: c.shortcut,
          loadLatest: c.loadLatest,
          overwrite: c.overwrite,
          synced: c.synced("{name}"),
          remoteChanged: c.remoteChanged("{name}"),
          conflict: c.conflict("{name}"),
          loading: t.common.loading,
        }}
      />
      <p className="text-xs text-muted">{c.downloadHint}</p>
    </div>
  );
}

export default async function CodePage({ params }: PageProps<"/[lang]/groups/[id]/code/[fileId]">) {
  const { t } = await getI18n();
  return (
    <Suspense fallback={<p className="text-muted">{t.common.loading}</p>}>
      <EditorPage params={params} />
    </Suspense>
  );
}
