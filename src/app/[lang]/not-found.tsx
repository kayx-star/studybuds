import Link from "next/link";
import { localePath } from "@/i18n/config";
import { getI18n } from "@/i18n/server";

export default async function NotFound() {
  const { locale, t } = await getI18n();
  return (
    <div className="card mx-auto max-w-md space-y-3 text-center">
      <div className="text-4xl">🔍</div>
      <h1 className="text-xl font-semibold">{t.common.notFound}</h1>
      <p className="text-sm text-muted">{t.common.notFoundHint}</p>
      <Link href={localePath(locale, "/me")} className="btn">{t.nav.matches}</Link>
    </div>
  );
}
