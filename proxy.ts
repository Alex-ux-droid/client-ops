import { NextResponse, type NextRequest } from "next/server";
import { isAuthed, SESSION_COOKIE } from "@/lib/session";

// Все, крім сторінки входу і статики, тільки після логіну.
export function proxy(req: NextRequest) {
  if (isAuthed(req.cookies.get(SESSION_COOKIE)?.value, req.headers.get("authorization"))) return NextResponse.next();
  if (req.nextUrl.pathname.startsWith("/api/")) return NextResponse.json({ error: "Потрібен вхід" }, { status: 401 });
  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = {
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico|manifest.webmanifest|icon).*)"],
};
