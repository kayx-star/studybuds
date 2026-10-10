import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { createFile } from "@/app/code-actions";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { getDb } from "@/db";
import { codeFiles, type Group, type Student } from "@/db/schema";
import { localePath } from "@/i18n/config";
import { formatDateTime } from "@/i18n/format";
import { getI18n } from "@/i18n/server";

export async function CodeSpace({ group, members }: { group: Group; members: Student[] }) {
  const { locale, t } = await getI18n();
  const c = t.code;
  const db = await getDb();
  const files = await db.select().from(codeFiles).where(eq(codeFiles.groupId, group.id)).orderBy(asc(codeFiles.name));
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? t.common.left;
  const base = localePath(locale, `/groups/${group.id}/code`);

  return (
    <section className="card space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="flex-1 font-semibold">{c.title}</h2>
        {files.length > 0 && (
          <a href={`${base}/download`} className="btn-ghost" title={c.downloadHint}>
            {c.download}
          </a>
        )}
      </div>

      {files.length === 0 ? (
        <p className="text-sm text-muted">{c.empty}</p>
      ) : (
        <ul className="divide-y divide-line">
          {files.map((f) => (
            <li key={f.id}>
              <Link href={`${base}/${f.id}`} className="flex flex-wrap items-center gap-x-3 py-2.5 hover:text-accent">
                <span className="font-mono text-sm">{f.name}</span>
                <span className="text-xs text-muted">{c.updatedBy(nameOf(f.updatedBy), formatDateTime(locale, f.updatedAt))}</span>
                <span className="ml-auto text-sm text-accent">{c.open} →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <ActionForm action={createFile} className="flex flex-wrap gap-2">
        <input type="hidden" name="groupId" value={group.id} />
        <input name="name" required className="input !w-auto flex-1 font-mono" placeholder={c.fileNamePlaceholder} />
        <SubmitButton pending={c.creating} variant="ghost">
          {c.create}
        </SubmitButton>
      </ActionForm>
      <p className="text-xs text-muted">{c.downloadHint}</p>
    </section>
  );
}
