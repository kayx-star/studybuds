import type { Quiz, QuizStatus } from "@/db/schema";

/** A background job still "generating" after this long was cut off (e.g. the serverless function timed out) */
const STALE_MS = 5 * 60_000;

/** The quiz status as it should be shown; stuck jobs count as failed so they can be retried */
export function quizState(quiz: Pick<Quiz, "status" | "createdAt">): QuizStatus {
  if (quiz.status === "generating" && Date.now() - quiz.createdAt.getTime() > STALE_MS) return "failed";
  return quiz.status;
}
