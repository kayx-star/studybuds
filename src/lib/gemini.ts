import "server-only";
import { GoogleGenAI } from "@google/genai";
import type { PlanStep, Student } from "@/db/schema";
import { GOALS, MODES, PACES, STYLE_TAGS, labelOf, slotLabel } from "./constants";

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;
const MODEL = process.env.GEMINI_MODEL ?? "gemini-flash-latest";

export const geminiEnabled = ai !== null;

async function askJson<T>(prompt: string, schema: object): Promise<T | null> {
  if (!ai) return null;
  try {
    const res = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: { responseMimeType: "application/json", responseJsonSchema: schema },
    });
    return JSON.parse(res.text ?? "") as T;
  } catch (err) {
    console.error("[gemini] 调用失败，改用规则兜底：", err);
    return null;
  }
}

/** 读自我介绍，提炼一句学习画像，并补充风格标签 */
export async function analyzeBio(bio: string) {
  if (!bio.trim()) return null;
  const result = await askJson<{ summary: string; tags: string[] }>(
    `你是大学学习小组的匹配助手。下面是一位同学的自我介绍，请：
1. 用不超过 30 个字概括 TA 的学习画像（第三人称，中文）；
2. 从这些标签里选出符合 TA 的（可多选，不确定就不选）：${STYLE_TAGS.join("、")}。

自我介绍：
"""${bio.slice(0, 1000)}"""`,
    {
      type: "object",
      properties: {
        summary: { type: "string" },
        tags: { type: "array", items: { type: "string", enum: [...STYLE_TAGS] } },
      },
      required: ["summary", "tags"],
    },
  );
  if (!result) return null;
  return {
    summary: result.summary.slice(0, 60),
    tags: result.tags.filter((t) => (STYLE_TAGS as readonly string[]).includes(t)),
  };
}

function describe(s: Student, score?: number) {
  return [
    `id=${s.id}`,
    `昵称=${s.name}`,
    score !== undefined ? `与发起人匹配分=${score}` : null,
    `节奏=${labelOf(PACES, s.pace)}`,
    `方式=${labelOf(MODES, s.mode)}`,
    `目标=${labelOf(GOALS, s.goal)}`,
    `风格=${s.tags.join("/") || "未填"}`,
    `期望人数=${s.groupSize}`,
    `空闲=${s.slots.map(slotLabel).join("、")}`,
    s.aiSummary ? `画像=${s.aiSummary}` : null,
  ]
    .filter(Boolean)
    .join("；");
}

export type GroupPlan = {
  memberIds: string[];
  groupName: string;
  reason: string;
  plan: PlanStep[];
};

/** 让 Gemini 从候选人中挑组员，并写出小组学习计划 */
export async function planGroup(
  course: string,
  me: Student,
  pool: { student: Student; score: number }[],
): Promise<GroupPlan | null> {
  const want = me.groupSize - 1;
  return askJson<GroupPlan>(
    `你是大学课程「${course}」的学习小组组建助手。
发起人希望组成 ${me.groupSize} 人小组（含自己），请从候选人中挑选 ${want} 人（人选不够时可以少选），
优先保证所有成员有共同空闲时间，其次兼顾学习节奏、目标、线上/线下方式和风格互补。
然后给小组起个有趣的中文名字，用一两句话说明为什么这样组队，并给出 4 条具体的学习计划
（例如每周固定学习时间安排、分工方式、复习/刷题节奏、考前安排），结合这门课的特点来写。

发起人：${describe(me)}

候选人：
${pool.map((p) => "- " + describe(p.student, p.score)).join("\n")}

memberIds 只能填候选人的 id，不要包含发起人。`,
    {
      type: "object",
      properties: {
        memberIds: { type: "array", items: { type: "string" } },
        groupName: { type: "string" },
        reason: { type: "string" },
        plan: {
          type: "array",
          items: {
            type: "object",
            properties: { title: { type: "string" }, detail: { type: "string" } },
            required: ["title", "detail"],
          },
        },
      },
      required: ["memberIds", "groupName", "reason", "plan"],
    },
  );
}
