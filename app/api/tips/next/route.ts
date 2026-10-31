import { NextResponse, type NextRequest } from "next/server";
import { autoOn } from "@/lib/agent/caps";
import { nextTip, TIP_TOPICS } from "@/lib/repo/tips";
import { isAuthed, SESSION_COOKIE } from "@/lib/session";

// Наступна порада, якщо вже час. Клієнт питає раз на хвилину, тільки коли Саша активний на сторінці.
export async function GET(req: NextRequest) {
  if (!isAuthed(req.cookies.get(SESSION_COOKIE)?.value, req.headers.get("authorization"))) return NextResponse.json({ error: "Потрібен вхід" }, { status: 401 });
  const force = req.nextUrl.searchParams.get("force") === "1";
  if (!autoOn("tips") && !force) return NextResponse.json({ tip: null }, { headers: { "cache-control": "no-store" } });
  const tip = nextTip(force);
  return NextResponse.json({ tip: tip && { id: tip.id, topic: tip.topic, topic_label: TIP_TOPICS[tip.topic] ?? "Порада", title: tip.title, body: tip.body } }, { headers: { "cache-control": "no-store" } });
}
