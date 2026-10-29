import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

// Все, крім сторінки входу і статики, тільки після логіну.
export function proxy(req: NextRequest) {
  if (verifySession(req.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = {
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico|manifest.webmanifest|icon).*)"],
};
