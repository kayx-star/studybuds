import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { GeminiNotice } from "@/components/gemini-notice";
import { JoinForm, type JoinLabels } from "@/components/join-form";
import { getDb } from "@/db";
import { students } from "@/db/schema";
import { localePath } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import type { Dict } from "@/i18n/zh";
import {
  CAMPUSES,
  DAYS,
  GENDERS,
  GENDER_PREFS,
  GOALS,
  MODES,
  PACES,
  PERIODS,
  PERSONALITIES,
  PERSONALITY_PREFS,
  STYLE_TAGS,
} from "@/lib/constants";
import { currentStudentId } from "@/lib/session";

function labels(t: Dict): JoinLabels {
  const j = t.join;
  const o = t.options;
  return {
    name: j.name,
    namePlaceholder: j.namePlaceholder,
    contact: j.contact,
    contactPlaceholder: j.contactPlaceholder,
    courses: j.courses,
    coursesPlaceholder: j.coursesPlaceholder,
    coursesHint: j.coursesHint,
    slots: j.slots,
    pace: j.pace,
    mode: j.mode,
    goal: j.goal,
    tags: j.tags,
    groupSize: j.groupSize,
    strong: j.strong,
    strongPlaceholder: j.strongPlaceholder,
    weak: j.weak,
    weakPlaceholder: j.weakPlaceholder,
    strongWeakHint: j.strongWeakHint,
    bio: j.bio,
    bioPlaceholder: j.bioPlaceholder,
    save: j.save,
    create: j.create,
    saving: j.saving,
    coursesSeparator: t.list(["", ""]), // 即该语言的列表分隔符：“、”或“, ”
    days: DAYS.map((d) => ({ key: d.key, label: o.days[d.key] })),
    periods: PERIODS.map((p) => ({ key: p.key, label: o.periods[p.key] })),
    paces: PACES.map((p) => ({ key: p.key, label: o.paces[p.key] })),
    modes: MODES.map((m) => ({ key: m.key, label: o.modes[m.key] })),
    goals: GOALS.map((g) => ({ key: g.key, label: o.goals[g.key] })),
    styleTags: STYLE_TAGS.map((tag) => ({ key: tag, label: o.tags[tag] ?? tag })),
    groupSizes: [2, 3, 4, 5, 6].map((n) => ({ key: String(n), label: j.people(n) })),
    preferences: j.preferences,
    gender: j.gender,
    genderPref: j.genderPref,
    genderHint: j.genderHint,
    campus: j.campus,
    campusPref: j.campusPref,
    campusNone: j.campusNone,
    personality: j.personality,
    personalityPref: j.personalityPref,
    genders: GENDERS.map((g) => ({ key: g.key, label: o.genders[g.key] })),
    genderPrefs: GENDER_PREFS.map((g) => ({ key: g.key, label: o.genderPrefs[g.key] })),
    campuses: CAMPUSES.map((c) => ({ key: c.key, label: o.campuses[c.key] })),
    personalities: PERSONALITIES.map((x) => ({ key: x.key, label: o.personalities[x.key] })),
    personalityPrefs: PERSONALITY_PREFS.map((x) => ({ key: x.key, label: o.personalityPrefs[x.key] })),
  };
}

async function FormWithProfile() {
  const [{ locale, t }, sid] = await Promise.all([getI18n(), currentStudentId()]);
  if (!sid) redirect(localePath(locale, "/login?next=/join"));
  const db = await getDb();
  const [student] = await db.select().from(students).where(eq(students.id, sid));
  return <JoinForm student={student ?? null} l={labels(t)} />;
}

export default async function JoinPage() {
  const { t } = await getI18n();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t.join.title}</h1>
        <p className="mt-1 text-sm text-muted">{t.join.subtitle}</p>
      </div>
      <Suspense>
        <GeminiNotice />
      </Suspense>
      <Suspense fallback={<p className="text-muted">{t.common.loading}</p>}>
        <FormWithProfile />
      </Suspense>
    </div>
  );
}
