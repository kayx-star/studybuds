# 📚 StudyBuds

**Find study partners at Rutgers by subject, course section, schedule and study style — then study together with AI help.**
按科目、具体课程班级（Index）、空闲时间和学习风格匹配 Rutgers 同学，组成学习小组，并用 Gemini 辅助学习。

Available in **中文 / English / Español**.

🔗 **Live:** https://studybuds.tech

---

## ✨ Features

| | |
|---|---|
| 🎯 **Smart matching** | 0–100 match score from shared free time, pace, online/in-person mode, goals, study style, campus, personality and peer ratings. Same course **+10**, same section (Index) **+8**. Gender preference is a two-way hard filter. |
| 🏫 **Rutgers subjects & courses** | Pick from all 166 NB undergraduate subjects; optionally search & autocomplete 2,599 Fall 2026 courses by number (`198:111`), title, or 5-digit index (`11389`). |
| 🤝 **Complementary matching** | Gemini finds classmates who are strong where you're weak — and vice versa. |
| ✉️ **Invite-based groups** | Pick classmates (or let Gemini pick) and send invites; members join only after accepting. Contacts are visible to members only. |
| 📅 **Study sessions** | Suggested times from everyone's shared free slots, RSVP, export to calendar (`.ics`). |
| 🏆 **AI quizzes** | Gemini writes quizzes from a chapter or your notes; wrong answers show the concept you missed and why. Group leaderboard. |
| 💻 **Code together** | Shared files in a Monaco (VS Code) editor with live sync and conflict detection; download as a VS Code project. |
| ⭐ **Peer reviews** | 1–5 star ratings (reliability / contribution / communication), anonymous or named. Ratings feed back into matching. |
| 👥 **Friends & chat** | Search classmates, friend requests, 1-on-1 messages with emoji and on-demand translation. |
| 🌐 **Three languages** | UI, user content and AI output are shown in the selected language (translated via Gemini and cached). |
| 📱 **Installable (PWA)** | Add to home screen on iPhone/Android for an app-like experience. |
| 🛟 **Graceful fallback** | When Gemini is unavailable or out of quota, matching and grouping fall back to a rule-based algorithm and users are told. |

## 🛠 Built with

- **Next.js 16** (App Router, Server Actions, Cache Components) + **TypeScript** + **Tailwind CSS 4**
- **SQLite / libSQL** + **Drizzle ORM** (local file; switch to Turso for the cloud)
- **Google Gemini API** (`@google/genai`) — profile analysis, grouping, complementary matching, quizzes, translation
- **Monaco Editor** for collaborative code, **pinyin-pro** for name romanization, **fflate** for project export
- Course data from the public **Rutgers Schedule of Classes** API

## 🏗 How it works

```
Browser ──► Next.js (Server Components + Server Actions)
              ├── src/lib/match.ts       match scoring & greedy grouping (rule-based)
              ├── src/lib/gemini.ts      Gemini prompts, retries, quota pause & fallback
              ├── src/lib/translate.ts   3-language translation cache (translations table)
              ├── src/lib/courses.ts     Rutgers course search / autocomplete
              ├── src/lib/session.ts     auth: scrypt passwords, hashed session tokens
              └── src/db/                Drizzle schema → SQLite (local.db) / Turso
```

Security notes: passwords are hashed with scrypt; session and password-reset tokens are stored as SHA-256 hashes; contact info is only visible to group members; friend search never reveals emails; login is rate-limited.

## 🚀 Run locally

Requires Node.js 20+.

```bash
npm install
cp .env.example .env.local     # add your GEMINI_API_KEY (free at https://aistudio.google.com/apikey)
npm run seed                   # optional: 20 demo students (demo-0@example.com … demo-19@example.com, password demo1234)
npm run dev                    # http://localhost:3000
```

Environment variables (see `.env.example`): `GEMINI_API_KEY`, optional `GEMINI_MODEL`, `GEMINI_TRANSLATE_MODEL`, `DATABASE_URL` / `DATABASE_AUTH_TOKEN` (Turso), SMTP settings for password-reset email, and `APP_URL`.

## 📁 Project structure

```
src/app/[lang]/        pages (zh / en / es): join, me, groups, quizzes, messages, friends, login…
src/app/*actions.ts    server actions (every group action checks membership)
src/components/        UI: subject & course pickers, chat, code editor, emoji picker…
src/i18n/              dictionaries (zh.ts defines the shape; en/es are type-checked against it)
src/lib/               matching, Gemini, translation, courses, sessions, mail
src/data/              Rutgers NB Fall 2026 undergraduate courses (compact JSON)
```

---

## 中文简介

StudyBuds 帮 Rutgers 同学找到**同课、同时间、同节奏**的学习伙伴：

- **匹配**：选择科目（Subject），可选填具体课程或 Index 班级；同一门课、同一个班的同学优先推荐，并给出推荐理由。
- **组队**：手动勾选或让 Gemini 挑人后发邀请，对方接受才入组。
- **小组内**：约自习（导出日历）、AI 出题与知识点诊断、代码协作（VS Code 同款编辑器）、学习计划、搭子互评。
- **社交**：好友搜索与申请、私信（表情、按需翻译）。
- **三语**：中文 / English / Español，用户内容与 AI 内容也会翻译成当前语言。
- **可安装**：手机浏览器“添加到主屏幕”即可像 App 一样使用。

> This project was developed with the help of AI coding tools (Claude Code).
