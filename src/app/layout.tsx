import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "学习搭子",
  description: "按课程、时间、学习风格匹配同学，组成学习小组",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <header className="border-b border-line bg-surface/80 backdrop-blur sticky top-0 z-10">
          <nav className="mx-auto max-w-4xl px-4 h-14 flex items-center gap-6 text-sm">
            <Link href="/" className="font-semibold text-base">
              📚 学习搭子
            </Link>
            <div className="ml-auto flex gap-5 text-muted">
              <Link href="/join" className="hover:text-fg">我的资料</Link>
              <Link href="/me" className="hover:text-fg">匹配与小组</Link>
            </div>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-4xl px-4 py-8 flex-1">{children}</main>
      </body>
    </html>
  );
}
