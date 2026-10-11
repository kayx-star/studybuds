import type { Review } from "@/db/schema";

export type Rating = {
  avg: number;
  count: number;
  reliability: number;
  contribution: number;
  communication: number;
};

/** Aggregates the peer reviews each student received */
export function summarizeRatings(reviews: Review[]) {
  const byStudent = new Map<string, Review[]>();
  for (const r of reviews) byStudent.set(r.revieweeId, [...(byStudent.get(r.revieweeId) ?? []), r]);

  const result = new Map<string, Rating>();
  for (const [id, list] of byStudent) {
    const mean = (pick: (r: Review) => number) => list.reduce((s, r) => s + pick(r), 0) / list.length;
    const reliability = mean((r) => r.reliability);
    const contribution = mean((r) => r.contribution);
    const communication = mean((r) => r.communication);
    result.set(id, {
      avg: (reliability + contribution + communication) / 3,
      count: list.length,
      reliability,
      contribution,
      communication,
    });
  }
  return result;
}
