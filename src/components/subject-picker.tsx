"use client";

import { useMemo, useRef, useState } from "react";

export type SubjectOption = {
  code: string;
  /** 当前语言的显示文字，如 “计算机科学 (198)” */
  label: string;
  /** 用于搜索：三种语言的名称 + 代码，小写 */
  search: string;
};

export const MAX_SUBJECTS = 8;
const MAX = MAX_SUBJECTS;

/**
 * 科目选择器：仿 Rutgers Course Search 的 Subject 下拉框。
 * 点击输入框展开全部科目，输入文字筛选，点选或回车加入（选中后收起列表）；
 * 已选科目以标签显示在输入框上方，避免被展开的列表挡住。
 * 选中的科目代码通过隐藏的 <input name="courses"> 随表单提交。
 */
export function SubjectPicker({
  options,
  selected,
  onChange,
  placeholder,
  noMatch,
  maxReached,
  removeLabel,
}: {
  options: SubjectOption[];
  /** 由父组件管理：选课程时会自动补上对应科目 */
  selected: string[];
  onChange: (codes: string[]) => void;
  placeholder: string;
  noMatch: string;
  maxReached: string;
  removeLabel: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const byCode = useMemo(() => new Map(options.map((o) => [o.code, o])), [options]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options.filter((o) => !selected.includes(o.code) && (!q || o.search.includes(q)));
  }, [options, query, selected]);

  const add = (code: string) => {
    if (selected.length >= MAX || selected.includes(code)) return;
    onChange([...selected, code]);
    setQuery("");
    setActive(0);
    setOpen(false);
  };

  const scrollTo = (i: number) => {
    listRef.current?.children[i]?.scrollIntoView({ block: "nearest" });
  };

  return (
    <div className="space-y-2">
      {selected.map((code) => (
        <input key={code} type="hidden" name="courses" value={code} />
      ))}

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((code) => (
            <span key={code} className="chip !py-1 text-sm">
              {byCode.get(code)?.label ?? code}
              <button
                type="button"
                onClick={() => onChange(selected.filter((c) => c !== code))}
                className="ml-1.5 text-muted hover:text-red-600"
                aria-label={`${removeLabel} ${byCode.get(code)?.label ?? code}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <div className="flex items-center rounded-md border-2 border-red-700 bg-surface">
          <input
            id="courses"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              setActive(0);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setOpen(true);
                const i = Math.min(active + 1, filtered.length - 1);
                setActive(i);
                scrollTo(i);
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                const i = Math.max(active - 1, 0);
                setActive(i);
                scrollTo(i);
              } else if (e.key === "Enter") {
                // 回车选中高亮项，而不是提交整个表单
                e.preventDefault();
                if (open && filtered[active]) add(filtered[active].code);
              } else if (e.key === "Escape") {
                setOpen(false);
              }
            }}
            placeholder={selected.length >= MAX ? maxReached : placeholder}
            disabled={selected.length >= MAX}
            autoComplete="off"
            role="combobox"
            aria-expanded={open}
            aria-controls="subject-list"
            className="w-full bg-transparent px-3 py-2 text-sm outline-none"
          />
          <button
            type="button"
            tabIndex={-1}
            onMouseDown={(e) => {
              e.preventDefault();
              setOpen((v) => !v);
              document.getElementById("courses")?.focus();
            }}
            className="mr-1 flex h-7 w-7 items-center justify-center border-l border-line text-xs text-sky-600"
            aria-label="▼"
          >
            ▼
          </button>
        </div>

        {open && (
          <ul
            id="subject-list"
            ref={listRef}
            role="listbox"
            // 按住列表时不让输入框失焦，否则点不到选项
            onMouseDown={(e) => e.preventDefault()}
            className="absolute z-20 mt-0.5 max-h-80 w-full overflow-y-auto border border-slate-400 bg-white text-[13px] text-black shadow-lg dark:bg-slate-900 dark:text-slate-100"
          >
            {filtered.length === 0 ? (
              <li className="px-1.5 py-1 text-muted">{noMatch}</li>
            ) : (
              filtered.map((o, i) => (
                <li
                  key={o.code}
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => add(o.code)}
                  className={`cursor-pointer px-1.5 py-[3px] ${i === active ? "bg-sky-100 outline outline-1 outline-sky-400 dark:bg-sky-900" : ""}`}
                >
                  {o.label}
                </li>
              ))
            )}
          </ul>
        )}
      </div>

    </div>
  );
}
