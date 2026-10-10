"use client";

import { useState } from "react";
import { createSession } from "@/app/group-actions";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import type { Suggestion } from "@/lib/schedule";

export function SessionForm({ groupId, suggestions, today }: { groupId: string; suggestions: Suggestion[]; today: string }) {
  const [date, setDate] = useState(suggestions[0]?.date ?? today);
  const [start, setStart] = useState(suggestions[0]?.start ?? "19:00");

  return (
    <ActionForm action={createSession} className="space-y-3">
      <input type="hidden" name="groupId" value={groupId} />
      {suggestions.length > 0 && (
        <div>
          <span className="mb-1.5 block text-xs text-muted">按共同空闲时间推荐：</span>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => {
              const active = s.date === date && s.start === start;
              return (
                <button
                  key={s.date + s.start}
                  type="button"
                  onClick={() => {
                    setDate(s.date);
                    setStart(s.start);
                  }}
                  className={`rounded-full border px-3 py-1 text-xs ${active ? "border-accent bg-accent-soft text-accent" : "border-line hover:bg-accent-soft"}`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm">
          日期
          <input type="date" name="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} className="input mt-1" />
        </label>
        <label className="text-sm">
          开始时间
          <input type="time" name="start" value={start} onChange={(e) => setStart(e.target.value)} className="input mt-1" />
        </label>
        <label className="text-sm">
          时长
          <select name="minutes" defaultValue={120} className="input mt-1">
            {[60, 90, 120, 180, 240].map((m) => (
              <option key={m} value={m}>{m / 60} 小时</option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="place" className="input" placeholder="地点（如：图书馆 3 楼）或线上会议链接" />
        <input name="topic" className="input" placeholder="主题（可选，如：第三章习题）" />
      </div>
      <SubmitButton pending="发起中…">发起自习</SubmitButton>
    </ActionForm>
  );
}
