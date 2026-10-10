"use client";

import { startTransition, useActionState } from "react";
import { saveProfile, type JoinState } from "@/app/actions";
import type { Student } from "@/db/schema";

type Option = { key: string; label: string };

/** 由服务端页面按当前语言准备好的文字（客户端组件只能接收纯数据） */
export type JoinLabels = {
  name: string;
  namePlaceholder: string;
  contact: string;
  contactPlaceholder: string;
  courses: string;
  coursesPlaceholder: string;
  coursesHint: string;
  slots: string;
  pace: string;
  mode: string;
  goal: string;
  tags: string;
  groupSize: string;
  strong: string;
  strongPlaceholder: string;
  weak: string;
  weakPlaceholder: string;
  strongWeakHint: string;
  bio: string;
  bioPlaceholder: string;
  save: string;
  create: string;
  saving: string;
  coursesSeparator: string;
  days: Option[];
  periods: Option[];
  paces: Option[];
  modes: Option[];
  goals: Option[];
  styleTags: Option[];
  groupSizes: Option[];
  preferences: string;
  gender: string;
  genderPref: string;
  genderHint: string;
  campus: string;
  campusPref: string;
  campusNone: string;
  personality: string;
  personalityPref: string;
  genders: Option[];
  genderPrefs: Option[];
  campuses: Option[];
  personalities: Option[];
  personalityPrefs: Option[];
};

function Choice({
  name,
  options,
  value,
  multiple,
}: {
  name: string;
  options: Option[];
  value?: string | string[];
  multiple?: boolean;
}) {
  const checked = (key: string) => (Array.isArray(value) ? value.includes(key) : value === key);
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <label key={o.key} className="cursor-pointer">
          <input
            type={multiple ? "checkbox" : "radio"}
            name={name}
            value={o.key}
            defaultChecked={checked(o.key)}
            className="peer sr-only"
          />
          <span className="btn-ghost peer-checked:border-accent peer-checked:bg-accent-soft peer-checked:text-accent">
            {o.label}
          </span>
        </label>
      ))}
    </div>
  );
}

export function JoinForm({ student, l }: { student: Student | null; l: JoinLabels }) {
  const [state, action, isPending] = useActionState<JoinState, FormData>(saveProfile, {});

  // 用 onSubmit 手动提交，避免 React 在校验失败后清空已填内容
  return (
    <form
      action={action}
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
      className="space-y-6"
    >
      <div className="card grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="name">{l.name}</label>
          <input id="name" name="name" className="input" defaultValue={student?.name} placeholder={l.namePlaceholder} />
        </div>
        <div>
          <label className="label" htmlFor="contact">{l.contact}</label>
          <input
            id="contact"
            name="contact"
            className="input"
            defaultValue={student?.contact}
            placeholder={l.contactPlaceholder}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="courses">{l.courses}</label>
          <input
            id="courses"
            name="courses"
            className="input"
            defaultValue={student?.courses.join(l.coursesSeparator)}
            placeholder={l.coursesPlaceholder}
          />
          <p className="mt-1 text-xs text-muted">{l.coursesHint}</p>
        </div>
      </div>

      <div className="card">
        <span className="label">{l.slots}</span>
        <div className="overflow-x-auto">
          <table className="text-sm">
            <thead>
              <tr>
                <th />
                {l.days.map((d) => (
                  <th key={d.key} className="px-1 pb-2 font-normal text-muted">{d.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {l.periods.map((p) => (
                <tr key={p.key}>
                  <td className="pr-3 text-muted whitespace-nowrap first-letter:uppercase">{p.label}</td>
                  {l.days.map((d) => {
                    const slot = `${d.key}-${p.key}`;
                    return (
                      <td key={slot} className="p-1">
                        <label className="cursor-pointer">
                          <input
                            type="checkbox"
                            name="slots"
                            value={slot}
                            defaultChecked={student?.slots.includes(slot)}
                            className="peer sr-only"
                          />
                          <span className="block h-9 w-11 rounded-lg border border-line peer-checked:border-accent peer-checked:bg-accent" />
                        </label>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card space-y-5">
        <div>
          <span className="label">{l.pace}</span>
          <Choice name="pace" options={l.paces} value={student?.pace} />
        </div>
        <div>
          <span className="label">{l.mode}</span>
          <Choice name="mode" options={l.modes} value={student?.mode} />
        </div>
        <div>
          <span className="label">{l.goal}</span>
          <Choice name="goal" options={l.goals} value={student?.goal} />
        </div>
        <div>
          <span className="label">{l.tags}</span>
          <div className="flex flex-wrap gap-2">
            {l.styleTags.map((tag) => (
              <label key={tag.key} className="cursor-pointer">
                <input
                  type="checkbox"
                  name="tags"
                  value={tag.key}
                  defaultChecked={student?.tags.includes(tag.key)}
                  className="peer sr-only"
                />
                <span className="btn-ghost peer-checked:border-accent peer-checked:bg-accent-soft peer-checked:text-accent">
                  {tag.label}
                </span>
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="label" htmlFor="groupSize">{l.groupSize}</label>
          <select id="groupSize" name="groupSize" className="input max-w-40" defaultValue={student?.groupSize ?? 3}>
            {l.groupSizes.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="strong">{l.strong}</label>
            <input id="strong" name="strong" className="input" defaultValue={student?.strong} placeholder={l.strongPlaceholder} />
          </div>
          <div>
            <label className="label" htmlFor="weak">{l.weak}</label>
            <input id="weak" name="weak" className="input" defaultValue={student?.weak} placeholder={l.weakPlaceholder} />
          </div>
          <p className="-mt-2 text-xs text-muted sm:col-span-2">{l.strongWeakHint}</p>
        </div>
        <div>
          <label className="label" htmlFor="bio">{l.bio}</label>
          <textarea id="bio" name="bio" rows={4} className="input" defaultValue={student?.bio} placeholder={l.bioPlaceholder} />
        </div>
      </div>

      <div className="card space-y-5">
        <h2 className="font-semibold">{l.preferences}</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <span className="label">{l.gender}</span>
            <Choice name="gender" options={l.genders} value={student?.gender ?? "undisclosed"} />
          </div>
          <div>
            <span className="label">{l.genderPref}</span>
            <Choice name="genderPref" options={l.genderPrefs} value={student?.genderPref ?? "any"} />
          </div>
          <p className="-mt-2 text-xs text-muted sm:col-span-2">{l.genderHint}</p>
          <div>
            <span className="label">{l.campus}</span>
            <Choice name="campus" options={[{ key: "", label: l.campusNone }, ...l.campuses]} value={student?.campus ?? ""} />
          </div>
          <div>
            <span className="label">{l.campusPref}</span>
            <Choice name="campusPref" options={l.campuses} value={student?.campusPref ?? []} multiple />
          </div>
          <div>
            <span className="label">{l.personality}</span>
            <Choice
              name="personality"
              options={[{ key: "", label: l.campusNone }, ...l.personalities]}
              value={student?.personality ?? ""}
            />
          </div>
          <div>
            <span className="label">{l.personalityPref}</span>
            <Choice name="personalityPref" options={l.personalityPrefs} value={student?.personalityPref ?? "any"} />
          </div>
        </div>
      </div>

      {state.error && <p className="rounded-xl bg-red-500/10 px-4 py-2 text-sm text-red-600">{state.error}</p>}
      <button type="submit" className="btn" disabled={isPending}>
        {isPending ? l.saving : student ? l.save : l.create}
      </button>
    </form>
  );
}
