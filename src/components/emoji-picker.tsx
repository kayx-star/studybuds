"use client";

import { useEffect, useRef, useState } from "react";

// 分类用图标做标签，三种语言都不需要翻译
const GROUPS: { icon: string; emojis: string[] }[] = [
  {
    icon: "😀",
    emojis: "😀 😃 😄 😁 😆 😅 🤣 😂 🙂 😉 😊 😇 🥰 😍 🤩 😘 😋 😜 🤪 🤗 🤭 🤔 🤐 😐 😑 😶 😏 😒 🙄 😬 😌 😔 😪 😴 😷 🤒 🤯 🥳 😎 🤓 🧐 😕 😟 🙁 😮 😲 😳 🥺 😦 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 🥱 😤 😡 😠 🤬 💀 🤡 👻 🤖".split(" "),
  },
  {
    icon: "👍",
    emojis: "👍 👎 👌 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ ✋ 👋 👏 🙌 🫶 👐 🤲 🤝 🙏 💪 ✍️ 🫡 🤷 🙋 🙆 🙅 💁 🤦".split(" "),
  },
  {
    icon: "📚",
    emojis: "📚 📖 📝 ✏️ 🖊️ 📒 📓 📎 📌 📐 📏 🧮 💻 🖥️ ⌨️ 🧠 💡 🔬 🧪 🧬 🔭 📊 📈 🗓️ ⏰ ⏳ ☕ 🎓 🏫 🏆 🥇 🎯 ✅ ❌ ❓ ❗ 💯".split(" "),
  },
  {
    icon: "🐱",
    emojis: "🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🐔 🐧 🐦 🐤 🦄 🐝 🦋 🐢 🐙 🐳 🐬 🦖 🌸 🌻 🌈 ☀️ 🌙 ⭐ ❄️ 🔥".split(" "),
  },
  {
    icon: "🍔",
    emojis: "🍎 🍊 🍋 🍉 🍇 🍓 🍑 🥭 🍍 🥑 🍔 🍟 🍕 🌭 🌮 🍜 🍣 🍱 🥟 🍙 🍚 🍰 🎂 🍩 🍪 🍫 🍬 🍦 🧋 🥤 🍵 🍺 🥂".split(" "),
  },
  {
    icon: "❤️",
    emojis: "❤️ 🧡 💛 💚 💙 💜 🖤 🤍 💔 💕 💖 💯 💢 💥 💫 💤 💬 🎉 🎊 🎁 🎈 ✨ ⚡ 🚀 🎵 🎮 ⚽ 🏀 🏃 🚗 ✈️ 🏠 🆗 🆒 🆕".split(" "),
  },
];

const RECENT_KEY = "chat-recent-emojis";
const MAX_RECENT = 16;

function loadRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
  } catch {
    return [];
  }
}

/** 表情面板：点 😊 打开，点表情回调 onPick；记住最近用过的表情（仅存在本机浏览器） */
export function EmojiPicker({ onPick, label }: { onPick: (emoji: string) => void; label: string }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const box = useRef<HTMLDivElement>(null);

  // 点面板外面时关闭
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const pick = (emoji: string) => {
    onPick(emoji);
    const next = [emoji, ...recent.filter((e) => e !== emoji)].slice(0, MAX_RECENT);
    setRecent(next);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      // 隐私模式下存不了就算了
    }
  };

  const tabs = [...(recent.length ? [{ icon: "🕘", emojis: recent }] : []), ...GROUPS];
  const current = tabs[Math.min(tab, tabs.length - 1)];

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-label={label}
        title={label}
        onClick={() => {
          if (!open) {
            const r = loadRecent();
            setRecent(r);
            setTab(0);
          }
          setOpen(!open);
        }}
        className={`flex h-10 w-10 items-center justify-center rounded-xl border text-xl ${open ? "border-accent bg-accent-soft" : "border-line hover:bg-accent-soft"}`}
      >
        😊
      </button>
      {open && (
        <div className="absolute bottom-12 left-0 z-20 w-72 rounded-2xl border border-line bg-surface p-2 shadow-xl sm:w-80">
          <div className="mb-1 flex gap-1 border-b border-line pb-1">
            {tabs.map((g, i) => (
              <button
                key={g.icon}
                type="button"
                onClick={() => setTab(i)}
                className={`flex-1 rounded-lg py-1 text-lg ${current === g ? "bg-accent-soft" : "hover:bg-accent-soft/60"}`}
              >
                {g.icon}
              </button>
            ))}
          </div>
          <div className="grid max-h-52 grid-cols-8 gap-0.5 overflow-y-auto">
            {current.emojis.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => pick(e)}
                className="rounded-lg p-1 text-xl leading-none hover:bg-accent-soft"
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
