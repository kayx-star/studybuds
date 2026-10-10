# 学习搭子

按课程、每周空闲时间、学习风格匹配同学，组成学习小组；Gemini 负责理解自我介绍、挑选组员并生成学习计划。

## 技术栈
- Next.js 16（App Router + Server Actions）+ TypeScript + Tailwind CSS 4
- SQLite（libSQL）+ Drizzle ORM：本地是 `local.db` 文件，上线可直接切换到 Turso
- Gemini（`@google/genai`）：未配置 Key 时自动回退到规则算法

## 本地运行
```bash
npm install
cp .env.example .env.local   # 填入 GEMINI_API_KEY
npm run seed                 # 可选：生成 20 位示例同学
npm run dev                  # 打开 http://localhost:3000
```

## 匹配逻辑（src/lib/match.ts）
同一门课的同学之间打分（0–100）：共同空闲时间 40%、节奏 15%、线上/线下 15%、目标 10%、风格标签 15%、期望人数 5%；没有共同时间的大幅降分。
组队时把前 8 名候选交给 Gemini 挑选组员（`src/lib/gemini.ts`），并校验所有人仍有共同时间，否则回退到贪心算法。

## 功能
- **相似匹配 / 互补匹配**：互补模式由 Gemini 分析“你擅长 TA 的弱项、TA 擅长你的弱项”，结果缓存在 `complements` 表
- **约自习**：按共同空闲时间推荐日期，组员报名，可导出 .ics 到日历
- **AI 出题比拼**：Gemini 按章节/笔记出单选题，每人作答一次，有单次排名与小组总榜
- **搭子互评**：守时靠谱/学习贡献/沟通友好 1–5 星，平均分显示在匹配卡片并计入匹配分（±6 分），评语匿名

## 目录
- `src/app/join` 填写/编辑资料
- `src/app/me` 推荐搭子 + 一键组队
- `src/app/groups/[id]` 小组详情：成员、约自习、出题比拼、学习计划、互评（联系方式仅组员可见）
- `src/app/quizzes/[id]` 答题与解析
- `src/app/group-actions.ts` 小组内的所有操作（均校验组员身份）
