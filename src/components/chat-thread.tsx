"use client";

import { useEffect, useRef, useState } from "react";
import { sendMessage, translateMessage, type ChatMessage } from "@/app/chat-actions";

export type ChatLabels = {
  placeholder: string;
  send: string;
  sending: string;
  translate: string;
  showOriginal: string;
  translating: string;
  empty: string;
  htmlLang: string;
};

const POLL_MS = 3000;

/** 一对一聊天：每 3 秒拉一次新消息；Enter 发送，Shift+Enter 换行 */
export function ChatThread({
  otherId,
  initial,
  pollUrl,
  l,
}: {
  otherId: string;
  initial: ChatMessage[];
  pollUrl: string;
  l: ChatLabels;
}) {
  const [list, setList] = useState(initial);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [translated, setTranslated] = useState<Record<string, string | "loading">>({});
  const [showOriginal, setShowOriginal] = useState<Record<string, boolean>>({});
  const bottom = useRef<HTMLDivElement>(null);
  const lastAt = useRef(initial.at(-1)?.at ?? 0);

  // 合并新消息（按 id 去重），并记录最新时间
  const merge = (incoming: ChatMessage[]) => {
    if (incoming.length === 0) return;
    setList((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      return [...prev, ...incoming.filter((m) => !seen.has(m.id))].sort((a, b) => a.at - b.at);
    });
    lastAt.current = Math.max(lastAt.current, ...incoming.map((m) => m.at));
  };

  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`${pollUrl}?after=${lastAt.current}`, { cache: "no-store" });
        if (res.ok) merge((await res.json()).messages);
      } catch {
        // 网络抖动时下一轮再试
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [pollUrl]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [list.length]);

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError("");
    const res = await sendMessage({ to: otherId, body });
    setSending(false);
    if (res.message) {
      merge([res.message]);
      setDraft("");
    } else {
      setError(res.error ?? "");
    }
  };

  const translate = async (id: string) => {
    setTranslated((p) => ({ ...p, [id]: "loading" }));
    const res = await translateMessage(id);
    if (res.text) {
      setTranslated((p) => ({ ...p, [id]: res.text! }));
    } else {
      setTranslated((p) => {
        const next = { ...p };
        delete next[id];
        return next;
      });
      setError(res.error ?? "");
    }
  };

  const time = (at: number) =>
    new Intl.DateTimeFormat(l.htmlLang, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(at);

  return (
    <div className="card flex flex-col gap-3 !p-3">
      <div className="max-h-[60vh] min-h-64 space-y-3 overflow-y-auto p-1">
        {list.length === 0 && <p className="py-10 text-center text-sm text-muted">{l.empty}</p>}
        {list.map((m) => {
          const tr = translated[m.id];
          const showTr = typeof tr === "string" && tr !== "loading" && !showOriginal[m.id];
          return (
            <div key={m.id} className={`flex flex-col ${m.mine ? "items-end" : "items-start"}`}>
              <div
                className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm ${
                  m.mine ? "bg-accent text-white" : "bg-accent-soft"
                }`}
              >
                {showTr ? tr : m.body}
              </div>
              <div className="mt-0.5 flex gap-2 text-[11px] text-muted">
                <span>{time(m.at)}</span>
                {!m.mine &&
                  (tr === "loading" ? (
                    <span>{l.translating}</span>
                  ) : typeof tr === "string" ? (
                    <button className="hover:text-accent" onClick={() => setShowOriginal((p) => ({ ...p, [m.id]: !p[m.id] }))}>
                      {showOriginal[m.id] ? l.translate : l.showOriginal}
                    </button>
                  ) : (
                    <button className="hover:text-accent" onClick={() => void translate(m.id)}>
                      {l.translate}
                    </button>
                  ))}
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>

      {error && <p className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-600">{error}</p>}
      <div className="flex items-end gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void send();
            }
          }}
          rows={2}
          maxLength={2000}
          placeholder={l.placeholder}
          className="input flex-1 resize-none"
        />
        <button className="btn" disabled={sending || !draft.trim()} onClick={() => void send()}>
          {sending ? l.sending : l.send}
        </button>
      </div>
    </div>
  );
}
