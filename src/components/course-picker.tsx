"use client";

import { useEffect, useRef, useState } from "react";

export type CourseItem = { id: string; code: string; title: string; index?: string; section?: string; instructor?: string };

export type CourseLabels = {
  placeholder: string;
  noMatch: string;
  loading: string;
  max: string;
  remove: string;
  wholeCourse: string;
  /** Template with placeholders: {sec} {idx} {who} */
  section: string;
};

const MAX = 10;

export function courseText(c: CourseItem, l: CourseLabels) {
  const sec = c.index
    ? l.section.replace("{sec}", c.section ?? "").replace("{idx}", c.index).replace("{who}", c.instructor ? " · " + c.instructor : "")
    : "";
  return { main: `${c.code} ${c.title}`, sub: sec };
}

/**
 * Optional Course / Index picker: type a course number, title or 5-digit index to search the server with autocomplete.
 * Picked courses appear as chips, and onAddSubject adds the course's subject to the Subject picker above.
 */
export function CoursePicker({
  initial,
  subjects,
  onAddSubject,
  l,
}: {
  initial: CourseItem[];
  subjects: string[];
  onAddSubject: (code: string) => void;
  l: CourseLabels;
}) {
  const [selected, setSelected] = useState<CourseItem[]>(initial);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CourseItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const subjectsKey = subjects.join(",");

  // Search 200 ms after typing stops instead of on every keystroke
  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/courses?q=${encodeURIComponent(q)}&s=${subjectsKey}`, { signal: ctrl.signal });
        const data: { results: CourseItem[] } = await res.json();
        setResults(data.results);
        setActive(0);
      } catch {
        // Cancelled by newer input, or a network issue: ignore
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query, subjectsKey]);

  const visible = results.filter((r) => !selected.some((s) => s.id === r.id));

  const add = (item: CourseItem) => {
    if (selected.length >= MAX) return;
    // Keep one entry per course: a specific section replaces the whole course, and vice versa
    const course = item.id.split("#")[0];
    setSelected([...selected.filter((s) => s.id.split("#")[0] !== course), item]);
    onAddSubject(item.id.slice(0, 3));
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  const scrollTo = (i: number) => listRef.current?.children[i]?.scrollIntoView({ block: "nearest" });

  return (
    <div className="space-y-2">
      {selected.map((c) => (
        <input key={c.id} type="hidden" name="classes" value={c.id} />
      ))}

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((c) => {
            const t = courseText(c, l);
            return (
              <span key={c.id} className="chip !py-1 text-sm">
                <span>
                  {t.main}
                  {t.sub && <span className="text-muted"> · {t.sub}</span>}
                </span>
                <button
                  type="button"
                  onClick={() => setSelected(selected.filter((s) => s.id !== c.id))}
                  className="ml-1.5 text-muted hover:text-red-600"
                  aria-label={`${l.remove} ${t.main}`}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}

      <div className="relative">
        <input
          id="classes"
          value={query}
          onChange={(e) => {
            const v = e.target.value;
            setQuery(v);
            setOpen(true);
            // Clear results when emptied; otherwise show "searching" and let the effect above fetch
            if (v.trim()) setLoading(true);
            else setResults([]);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              const i = Math.min(active + 1, visible.length - 1);
              setActive(i);
              scrollTo(i);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              const i = Math.max(active - 1, 0);
              setActive(i);
              scrollTo(i);
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (visible[active]) add(visible[active]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder={selected.length >= MAX ? l.max : l.placeholder}
          disabled={selected.length >= MAX}
          autoComplete="off"
          role="combobox"
          aria-expanded={open && query.trim() !== ""}
          aria-controls="course-list"
          className="input"
        />
        {open && query.trim() !== "" && (
          <ul
            id="course-list"
            ref={listRef}
            role="listbox"
            onMouseDown={(e) => e.preventDefault()}
            className="absolute z-20 mt-0.5 max-h-80 w-full overflow-y-auto border border-slate-400 bg-white text-[13px] text-black shadow-lg dark:bg-slate-900 dark:text-slate-100"
          >
            {loading && visible.length === 0 ? (
              <li className="px-2 py-1.5 text-muted">{l.loading}</li>
            ) : visible.length === 0 ? (
              <li className="px-2 py-1.5 text-muted">{l.noMatch}</li>
            ) : (
              visible.map((c, i) => {
                const t = courseText(c, l);
                return (
                  <li
                    key={c.id}
                    role="option"
                    aria-selected={i === active}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => add(c)}
                    className={`cursor-pointer px-2 py-1 ${i === active ? "bg-sky-100 outline outline-1 outline-sky-400 dark:bg-sky-900" : ""}`}
                  >
                    <div className={c.index ? "pl-4" : ""}>
                      {c.index ? (
                        <>
                          {t.sub} <span className="text-[11px] text-slate-500">{c.code}</span>
                        </>
                      ) : (
                        t.main
                      )}
                      {!c.index && <span className="ml-1 text-[11px] text-slate-500">{l.wholeCourse}</span>}
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
