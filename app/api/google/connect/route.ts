import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { authUrl, googleConfigured } from "@/lib/google";
import { publicOrigin } from "@/lib/origin";
import { isAuthed, SESSION_COOKIE } from "@/lib/session";

// Старт підключення Google: state у куці, щоб callback знав, що запит наш
export async function GET(req: NextRequest) {
  if (!isAuthed(req.cookies.get(SESSION_COOKIE)?.value, req.headers.get("authorization"))) return NextResponse.redirect(new URL("/login", req.url));
  const origin = publicOrigin(req);
  if (!googleConfigured()) return NextResponse.redirect(`${origin}/settings?tab=google&msg=${encodeURIComponent("Спершу встав Client ID і Client secret.")}`);
  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(authUrl(`${origin}/api/google/callback`, state));
  res.cookies.set("g_state", state, { httpOnly: true, secure: origin.startsWith("https"), sameSite: "lax", path: "/", maxAge: 600 });
  return res;
}
