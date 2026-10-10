import { NextResponse, type NextRequest } from "next/server";
import { LOCALE_COOKIE, isLocale, matchAcceptLanguage } from "@/i18n/config";

const ONE_YEAR = 60 * 60 * 24 * 365;

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const first = pathname.split("/")[1];

  if (isLocale(first)) {
    // 网址里已有语言：同步到 cookie，供 Server Action 和下次访问使用
    const response = NextResponse.next();
    if (request.cookies.get(LOCALE_COOKIE)?.value !== first) {
      response.cookies.set(LOCALE_COOKIE, first, { path: "/", maxAge: ONE_YEAR, sameSite: "lax" });
    }
    return response;
  }

  // 没有语言前缀：优先用上次选择的语言，其次看浏览器语言
  const saved = request.cookies.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(saved) ? saved : matchAcceptLanguage(request.headers.get("accept-language"));
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  // 跳过 Next 内部资源、/api 接口和带扩展名的静态文件（favicon.ico 等）
  matcher: ["/((?!_next|api/|.*\\.[^/]+$).*)"],
};
