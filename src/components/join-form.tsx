"use client";

import { startTransition, useActionState } from "react";
import { saveProfile, type JoinState } from "@/app/actions";
import type { Student } from "@/db/schema";
import { DAYS, GOALS, MODES, PACES, PERIODS, STYLE_TAGS } from "@/lib/constants";

function Choice({
  name,
  options,
  value,
}: {
  name: string;
  options: readonly { key: string; label: string }[];
  value?: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <label key={o.key} className="cursor-pointer">
          <input type="radio" name={name} value={o.key} defaultChecked={value === o.key} className="peer sr-only" />
          <span className="btn-ghost peer-checked:border-accent peer-checked:bg-accent-soft peer-checked:text-accent">
            {o.label}
          </span>
        </label>
      ))}
    </div>
  );
}

export function JoinForm({ student }: { student: Student | null }) {
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
          <label className="label" htmlFor="name">昵称</label>
          <input id="name" name="name" className="input" defaultValue={student?.name} placeholder="例如：小林" />
        </div>
        <div>
          <label className="label" htmlFor="contact">联系方式</label>
          <input
            id="contact"
            name="contact"
            className="input"
            defaultValue={student?.contact}
            placeholder="微信号 / 邮箱（仅组员可见）"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="courses">在学课程</label>
          <input
            id="courses"
            name="courses"
            className="input"
            defaultValue={student?.courses.join("，")}
            placeholder="用逗号分隔，例如：高等数学，CS101，大学英语"
          />
          <p className="mt-1 text-xs text-muted">课程名一致才能匹配到，建议用教务系统里的课程名或课程代码。</p>
        </div>
      </div>

      <div className="card">
        <span className="label">每周空闲时间（可多选）</span>
        <div className="overflow-x-auto">
          <table className="text-sm">
            <thead>
              <tr>
                <th />
                {DAYS.map((d) => (
                  <th key={d.key} className="px-1 pb-2 font-normal text-muted">{d.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERIODS.map((p) => (
                <tr key={p.key}>
                  <td className="pr-3 text-muted whitespace-nowrap">{p.label}</td>
                  {DAYS.map((d) => {
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
          <span className="label">学习节奏</span>
          <Choice name="pace" options={PACES} value={student?.pace} />
        </div>
        <div>
          <span className="label">学习方式</span>
          <Choice name="mode" options={MODES} value={student?.mode} />
        </div>
        <div>
          <span className="label">学习目标</span>
          <Choice name="goal" options={GOALS} value={student?.goal} />
        </div>
        <div>
          <span className="label">学习风格（可多选）</span>
          <div className="flex flex-wrap gap-2">
            {STYLE_TAGS.map((t) => (
              <label key={t} className="cursor-pointer">
                <input
                  type="checkbox"
                  name="tags"
                  value={t}
                  defaultChecked={student?.tags.includes(t)}
                  className="peer sr-only"
                />
                <span className="btn-ghost peer-checked:border-accent peer-checked:bg-accent-soft peer-checked:text-accent">
                  {t}
                </span>
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="label" htmlFor="groupSize">理想小组人数</label>
          <select id="groupSize" name="groupSize" className="input max-w-32" defaultValue={student?.groupSize ?? 3}>
            {[2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>{n} 人</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="bio">自我介绍（Gemini 会据此补充你的学习画像）</label>
          <textarea
            id="bio"
            name="bio"
            rows={4}
            className="input"
            defaultValue={student?.bio}
            placeholder="例如：数学基础一般，喜欢边做题边讨论，希望有人一起监督每天打卡……"
          />
        </div>
      </div>

      {state.error && <p className="rounded-xl bg-red-500/10 px-4 py-2 text-sm text-red-600">{state.error}</p>}
      <button type="submit" className="btn" disabled={isPending}>
        {isPending ? "保存中，Gemini 正在分析…" : student ? "保存修改" : "开始匹配"}
      </button>
    </form>
  );
}
