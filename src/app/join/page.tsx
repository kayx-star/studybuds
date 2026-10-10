import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { JoinForm } from "@/components/join-form";
import { getDb } from "@/db";
import { students } from "@/db/schema";
import { currentStudentId } from "@/lib/session";

async function FormWithProfile() {
  const sid = await currentStudentId();
  if (!sid) redirect("/login?next=/join");
  const db = await getDb();
  const [student] = await db.select().from(students).where(eq(students.id, sid));
  return <JoinForm student={student ?? null} />;
}

export default function JoinPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">我的学习资料</h1>
        <p className="mt-1 text-sm text-muted">填好后系统会为你的每门课推荐学习搭子。</p>
      </div>
      <Suspense fallback={<p className="text-muted">加载中…</p>}>
        <FormWithProfile />
      </Suspense>
    </div>
  );
}
