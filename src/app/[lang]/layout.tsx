import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { NavUser } from "@/components/nav-user";
import { HTML_LANG, LOCALES, localePath } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import "./globals.css";

export async function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export const viewport: Viewport = { themeColor: "#5b5bd6" };

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    title: t.meta.title,
    description: t.meta.description,
    // iPhone “添加到主屏幕”后全屏打开、使用 App 图标
    appleWebApp: { capable: true, title: t.meta.title, statusBarStyle: "default" },
    icons: { apple: "/icons/180.png" },
  };
}

export default async function RootLayout({ children }: LayoutProps<"/[lang]">) {
  const { locale, t } = await getI18n();
  return (
    <html lang={HTML_LANG[locale]} className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <header className="border-b border-line bg-surface/80 backdrop-blur sticky top-0 z-10">
          <nav className="mx-auto max-w-4xl px-4 min-h-14 py-2 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <Link href={localePath(locale, "/")} className="font-semibold text-base">
              {t.nav.brand}
            </Link>
            <div className="ml-auto flex flex-wrap items-center gap-x-5 gap-y-2 text-muted">
              <Suspense>
                <NavUser />
              </Suspense>
              <LanguageSwitcher locale={locale} label={t.nav.language} />
            </div>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-4xl px-4 py-8 flex-1">{children}</main>
      </body>
    </html>
  );
}
