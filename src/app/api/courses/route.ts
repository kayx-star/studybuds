import { searchCourses } from "@/lib/courses";

/** Course autocomplete: /api/courses?q=intro&s=198,640 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").slice(0, 60);
  const prefer = (url.searchParams.get("s") ?? "").split(",").filter((s) => /^\d{3}$/.test(s));
  return Response.json({ results: searchCourses(q, prefer) });
}
