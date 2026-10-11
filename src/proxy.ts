import { NextResponse, type NextRequest } from "next/server";
import { LOCALE_COOKIE, isLocale, matchAcceptLanguage } from "@/i18n/config";

const ONE_YEAR = 60 * 60 * 24 * 365;

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const first = pathname.split("/")[1];

  if (isLocale(first)) {
    // The URL already has a locale: sync it to the cookie for Server Actions and future visits
    const response = NextResponse.next();
    if (request.cookies.get(LOCALE_COOKIE)?.value !== first) {
      response.cookies.set(LOCALE_COOKIE, first, { path: "/", maxAge: ONE_YEAR, sameSite: "lax" });
    }
    return response;
  }

  // No locale prefix: use the last chosen language, otherwise the browser's language
  const saved = request.cookies.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(saved) ? saved : matchAcceptLanguage(request.headers.get("accept-language"));
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Skip Next internals, /api routes and static files with an extension (favicon.ico, etc.)
  matcher: ["/((?!_next|api/|.*\\.[^/]+$).*)"],
};
