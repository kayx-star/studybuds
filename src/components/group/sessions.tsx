import { desc, eq } from "drizzle-orm";
import { connection } from "next/server";
import { cancelSession, toggleAttend } from "@/app/group-actions";
import { getDb } from "@/db";
import { studySessions, type Group, type Student } from "@/db/schema";
import { localePath } from "@/i18n/config";
import { formatDay, formatSession, slotLabel } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { nextOccurrences, ymd } from "@/lib/schedule";
import { getTranslator } from "@/lib/translate";
import { SessionForm } from "./session-form";

export async function Sessions({ group, members, meId }: { group: Group; members: Student[]; meId: string | null }) {
  await connection();
  const { locale, t } = await getI18n();
  const s = t.sessions;
  const now = new Date();
  const today = ymd(now);
  const db = await getDb();
  const all = await db
    .select()
    .from(studySessions)
    .where(eq(studySessions.groupId, group.id))
    .orderBy(desc(studySessions.date));
  const upcoming = all.filter((x) => x.date >= today).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  const past = all.filter((x) => x.date < today).slice(0, 5);
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? t.common.left;
  const isMember = meId !== null && group.memberIds.includes(meId);
  const tr = await getTranslator(
    [...upcoming, ...past].flatMap((x) => [x.place, x.topic]),
    locale,
  );

  const suggestions = nextOccurrences(group.meetingSlots, now).map((o) => ({
    date: o.date,
    start: o.start,
    label: `${formatDay(locale, o.date)} · ${slotLabel(t, o.slot)}`,
  }));

  return (
    <section className="card space-y-4">
      <h2 className="font-semibold">{s.title}</h2>

      {upcoming.length === 0 ? (
        <p className="text-sm text-muted">{s.empty}</p>
      ) : (
        <ul className="space-y-3">
          {upcoming.map((x) => {
            const going = meId !== null && x.attendees.includes(meId);
            return (
              <li key={x.id} className="rounded-xl border border-line p-3">
                <div className="flex flex-wrap items-start gap-2">
                  <div className="flex-1 min-w-48">
                    <div className="font-medium">{formatSession(locale, x.date, x.start, x.minutes)}</div>
                    <div className="text-sm text-muted">
                      📍{" "}
                      {/^https?:\/\//.test(x.place) ? (
                        <a href={x.place} target="_blank" rel="noreferrer" className="text-accent underline">{x.place}</a>
                      ) : (
                        tr(x.place)
                      )}
                      {x.topic && ` · ${tr(x.topic)}`}
                    </div>
                    <div className="mt-1 text-xs text-muted">
                      {s.createdBy(nameOf(x.createdBy), x.attendees.length, group.memberIds.length, t.list(x.attendees.map(nameOf)))}
                    </div>
                  </div>
                  {isMember && (
                    <div className="flex flex-wrap gap-2">
                      <form action={toggleAttend}>
                        <input type="hidden" name="groupId" value={group.id} />
                        <input type="hidden" name="sessionId" value={x.id} />
                        <button className={going ? "btn-ghost" : "btn"}>{going ? s.unattend : s.attend}</button>
                      </form>
                      <a href={localePath(locale, `/sessions/${x.id}/ics`)} className="btn-ghost" title={s.calendarHint}>
                        {s.addToCalendar}
                      </a>
                      {x.createdBy === meId && (
                        <form action={cancelSession}>
                          <input type="hidden" name="groupId" value={group.id} />
                          <input type="hidden" name="sessionId" value={x.id} />
                          <button className="btn-ghost text-red-600">{s.cancel}</button>
                        </form>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {isMember && (
        <details>
          <summary className="cursor-pointer text-sm text-accent">{s.newSession}</summary>
          <div className="mt-3">
            <SessionForm
              groupId={group.id}
              suggestions={suggestions}
              today={today}
              l={{
                suggested: s.suggested,
                date: s.date,
                start: s.start,
                duration: s.duration,
                placePlaceholder: s.placePlaceholder,
                topicPlaceholder: s.topicPlaceholder,
                submit: s.submit,
                submitting: s.submitting,
                durations: [60, 90, 120, 180, 240].map((m) => ({ minutes: m, label: s.hours(m / 60) })),
              }}
            />
          </div>
        </details>
      )}

      {past.length > 0 && (
        <div className="text-xs text-muted">
          {s.recent}
          {t.list(past.map((x) => s.recentItem(formatDay(locale, x.date), x.attendees.length)))}
        </div>
      )}
    </section>
  );
}
