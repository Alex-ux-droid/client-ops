import { NextResponse, type NextRequest } from "next/server";
import { createSession, IDLE_MIN, isAuthed, parseSession, SESSION_COOKIE } from "@/lib/session";

// Все, крім сторінки входу і статики, тільки після логіну.
export function proxy(req: NextRequest) {
  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  if (isAuthed(cookie, req.headers.get("authorization"))) {
    const res = NextResponse.next();
    // «чужий компʼютер»: кожен запит продовжує сесію ще на 30 хв (не частіше ніж раз на хвилину)
    const s = parseSession(cookie);
    if (s.ok && s.mode === "i" && s.expires - Date.now() < (IDLE_MIN - 1) * 60_000) {
      const fresh = createSession(false);
      if (fresh) res.cookies.set(SESSION_COOKIE, fresh, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" });
    }
    return res;
  }
  if (req.nextUrl.pathname.startsWith("/api/")) return NextResponse.json({ error: "Потрібен вхід" }, { status: 401 });
  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = {
  matcher: ["/((?!login$|login/|api/telegram/webhook$|api/leadbot/|api/report/|_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/|sw.js|offline.html).*)"],
};
