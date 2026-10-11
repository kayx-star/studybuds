"use client";

import Editor from "@monaco-editor/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { saveFile } from "@/app/code-actions";
import { languageOf } from "@/lib/code";

export type CodeEditorLabels = {
  save: string;
  saving: string;
  saved: string;
  unsaved: string;
  shortcut: string;
  loadLatest: string;
  overwrite: string;
  synced: string; // contains a {name} placeholder
  remoteChanged: string; // contains a {name} placeholder
  conflict: string; // contains a {name} placeholder
  loading: string;
};

type Banner = { kind: "synced" | "remote" | "conflict" | "error"; text: string } | null;

const POLL_MS = 4000;

/**
 * Shared code editor (Monaco, the editor that powers VS Code).
 * Checks the server version every 4 s: loads others' changes automatically when there are no unsaved edits;
 * with unsaved edits it warns instead, and a save after someone else's change reports a conflict rather than overwriting.
 */
export function CodeEditor({
  groupId,
  fileId,
  name,
  initialContent,
  initialVersion,
  stateUrl,
  l,
}: {
  groupId: string;
  fileId: string;
  name: string;
  initialContent: string;
  initialVersion: number;
  stateUrl: string;
  l: CodeEditorLabels;
}) {
  const [content, setContent] = useState(initialContent);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<Banner>(null);
  const [conflict, setConflict] = useState<{ content: string; version: number } | null>(null);
  const version = useRef(initialVersion);
  // Remote version already announced, so polling doesn't keep replacing the banner (especially the conflict one)
  const notifiedVersion = useRef(initialVersion);
  // The polling callback needs the latest `dirty`, so mirror it in a ref
  const dirtyRef = useRef(false);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  const fill = (template: string, who: string) => template.replace("{name}", who);

  // Poll the server version
  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`${stateUrl}?file=${fileId}&since=${version.current}`, { cache: "no-store" });
        if (!res.ok) return;
        const data: { version: number; by: string; byMe: boolean; content?: string } = await res.json();
        if (data.version <= version.current || data.content === undefined) return;
        if (!dirtyRef.current) {
          version.current = data.version;
          setContent(data.content);
          if (!data.byMe) setBanner({ kind: "synced", text: fill(l.synced, data.by) });
        } else if (!data.byMe && data.version > notifiedVersion.current) {
          notifiedVersion.current = data.version;
          setBanner((b) => (b?.kind === "conflict" ? b : { kind: "remote", text: fill(l.remoteChanged, data.by) }));
        }
      } catch {
        // On a network hiccup, just try again next round
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [stateUrl, fileId, l.synced, l.remoteChanged]);

  const save = useCallback(
    async (force = false) => {
      setSaving(true);
      const result = await saveFile({ groupId, fileId, content, baseVersion: version.current, force });
      setSaving(false);
      if (result.ok) {
        version.current = result.version;
        setDirty(false);
        setConflict(null);
        setBanner(null);
      } else if ("conflict" in result) {
        notifiedVersion.current = Math.max(notifiedVersion.current, result.version);
        setConflict({ content: result.content, version: result.version });
        setBanner({ kind: "conflict", text: fill(l.conflict, result.by) });
      } else {
        setBanner({ kind: "error", text: result.error });
      }
    },
    [groupId, fileId, content, l.conflict],
  );

  // ⌘S / Ctrl+S saves
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  const loadLatest = async () => {
    const res = await fetch(`${stateUrl}?file=${fileId}&since=0`, { cache: "no-store" });
    const data: { version: number; content: string } = await res.json();
    version.current = data.version;
    setContent(data.content);
    setDirty(false);
    setConflict(null);
    setBanner(null);
  };

  const tone =
    banner?.kind === "synced" ? "bg-emerald-500/10 text-emerald-700" : banner ? "bg-amber-500/15 text-amber-800" : "";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-sm">{name}</span>
        <span className="text-xs text-muted">{dirty ? `● ${l.unsaved}` : l.saved}</span>
        <span className="ml-auto hidden text-xs text-muted sm:inline">{l.shortcut}</span>
        <button className="btn" disabled={saving || !dirty} onClick={() => void save()}>
          {saving ? l.saving : l.save}
        </button>
      </div>

      {banner && (
        <div className={`flex flex-wrap items-center gap-2 rounded-xl px-3 py-2 text-sm ${tone}`}>
          <span className="flex-1">{banner.text}</span>
          {(banner.kind === "remote" || conflict) && (
            <button className="btn-ghost !py-1" onClick={() => void loadLatest()}>
              {l.loadLatest}
            </button>
          )}
          {conflict && (
            <button className="btn-ghost !py-1" onClick={() => void save(true)}>
              {l.overwrite}
            </button>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-line">
        <Editor
          height="65vh"
          language={languageOf(name)}
          value={content}
          theme="vs-dark"
          loading={l.loading}
          options={{ minimap: { enabled: false }, fontSize: 14, tabSize: 4, automaticLayout: true }}
          onChange={(v) => {
            setContent(v ?? "");
            setDirty(true);
          }}
        />
      </div>
    </div>
  );
}
