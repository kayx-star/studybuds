import { eq } from "drizzle-orm";
import Link from "next/link";
import { logout } from "@/app/auth-actions";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { currentStudentId } from "@/lib/session";

export async function NavUser() {
  const uid = await currentStudentId();
  if (!uid) {
    return (
      <>
        <Link href="/login" className="hover:text-fg">登录</Link>
        <Link href="/signup" className="btn !py-1.5">注册</Link>
      </>
    );
  }
  const db = await getDb();
  const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, uid));
  return (
    <>
      <Link href="/join" className="hover:text-fg">我的资料</Link>
      <Link href="/me" className="hover:text-fg">匹配与小组</Link>
      <span className="hidden text-xs sm:inline">{user?.email}</span>
      <form action={logout}>
        <button className="hover:text-fg">退出</button>
      </form>
    </>
  );
}
