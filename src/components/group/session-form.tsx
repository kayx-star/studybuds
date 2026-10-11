"use client";

import { useState } from "react";
import { createSession } from "@/app/group-actions";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";

export type SessionFormLabels = {
  suggested: string;
  date: string;
  start: string;
  duration: string;
  placePlaceholder: string;
  topicPlaceholder: string;
  submit: string;
  submitting: string;
  durations: { minutes: number; label: string }[];
};

/** suggestion labels are already formatted for the current language on the server */
export function SessionForm({
  groupId,
  suggestions,
  today,
  l,
}: {
  groupId: string;
  suggestions: { date: string; start: string; label: string }[];
  today: string;
  l: SessionFormLabels;
}) {
  const [date, setDate] = useState(suggestions[0]?.date ?? today);
  const [start, setStart] = useState(suggestions[0]?.start ?? "19:00");

  return (
    <ActionForm action={createSession} className="space-y-3">
      <input type="hidden" name="groupId" value={groupId} />
      {suggestions.length > 0 && (
        <div>
          <span className="mb-1.5 block text-xs text-muted">{l.suggested}</span>
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
          {l.date}
          <input type="date" name="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} className="input mt-1" />
        </label>
        <label className="text-sm">
          {l.start}
          <input type="time" name="start" value={start} onChange={(e) => setStart(e.target.value)} className="input mt-1" />
        </label>
        <label className="text-sm">
          {l.duration}
          <select name="minutes" defaultValue={120} className="input mt-1">
            {l.durations.map((d) => (
              <option key={d.minutes} value={d.minutes}>{d.label}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="place" className="input" placeholder={l.placePlaceholder} />
        <input name="topic" className="input" placeholder={l.topicPlaceholder} />
      </div>
      <SubmitButton pending={l.submitting}>{l.submit}</SubmitButton>
    </ActionForm>
  );
}
