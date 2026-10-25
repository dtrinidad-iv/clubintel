import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

const APP_PATHS = ["/dashboard", "/settings", "/onboarding"];
const GUEST_PATHS = ["/login", "/signup"];

export async function proxy(request: NextRequest) {
  const { response, userId } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  if (!userId && APP_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname + search);
    return redirectWithCookies(url, response);
  }
  if (userId && GUEST_PATHS.includes(pathname)) {
    return redirectWithCookies(new URL("/dashboard", request.url), response);
  }
  return response;
}

// Keep any refreshed session cookies when redirecting.
function redirectWithCookies(url: URL, from: NextResponse) {
  const redirect = NextResponse.redirect(url);
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
