import { NextResponse, type NextRequest } from "next/server";
import { finishAuth } from "@/lib/google";
import { logError } from "@/lib/log";
import { publicOrigin } from "@/lib/origin";
import { isAuthed, SESSION_COOKIE } from "@/lib/session";

export async function GET(req: NextRequest) {
  const origin = publicOrigin(req);
  const back = (msg: string, ok = false) => {
    const res = NextResponse.redirect(`${origin}/settings?tab=google&msg=${encodeURIComponent(msg)}${ok ? "&ok=1" : ""}`);
    res.cookies.delete("g_state");
    return res;
  };
  if (!isAuthed(req.cookies.get(SESSION_COOKIE)?.value, req.headers.get("authorization"))) return NextResponse.redirect(`${origin}/login`);
  const p = req.nextUrl.searchParams;
  if (p.get("error")) return back(p.get("error") === "access_denied" ? "Ти скасував підключення Google." : `Google: ${p.get("error")}`);
  if (!p.get("state") || p.get("state") !== req.cookies.get("g_state")?.value) return back("Посилання застаріло, спробуй підключити ще раз.");
  try {
    const email = await finishAuth(p.get("code") ?? "", `${origin}/api/google/callback`);
    return back(`Google підключено: ${email}`, true);
  } catch (e) {
    logError("google-callback", e);
    return back(e instanceof Error ? e.message : "Не вдалось підключити Google");
  }
}
