import { eq } from "drizzle-orm";
import Link from "next/link";
import { logout } from "@/app/auth-actions";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { localePath } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { currentStudentId } from "@/lib/session";

export async function NavUser() {
  const [{ locale, t }, uid] = await Promise.all([getI18n(), currentStudentId()]);
  const to = (path: string) => localePath(locale, path);
  if (!uid) {
    return (
      <>
        <Link href={to("/login")} className="hover:text-fg">{t.nav.login}</Link>
        <Link href={to("/signup")} className="btn !py-1.5">{t.nav.signup}</Link>
      </>
    );
  }
  const db = await getDb();
  const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, uid));
  return (
    <>
      <Link href={to("/join")} className="hover:text-fg">{t.nav.profile}</Link>
      <Link href={to("/me")} className="hover:text-fg">{t.nav.matches}</Link>
      <span className="hidden text-xs md:inline">{user?.email}</span>
      <form action={logout}>
        <button className="hover:text-fg">{t.nav.logout}</button>
      </form>
    </>
  );
}
