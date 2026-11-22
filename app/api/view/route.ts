import { NextResponse, type NextRequest } from "next/server";
import { addClick, addView, normPath } from "@/lib/repo/pageViews";

// Трекер користування: відкриті розділи і натиснуті кнопки (тільки підписи). Сторінка закрита proxy; перевірки Claude (Bearer) не рахуємо.
export async function POST(req: NextRequest) {
  if (req.headers.get("authorization")) return NextResponse.json({ ok: true });
  try {
    const { path, search, label } = (await req.json()) as { path?: string; search?: string; label?: string };
    if (path && path.startsWith("/") && !path.startsWith("/api")) {
      const p = normPath(path, search ?? "");
      if (label) addClick(p, label.replace(/\s+/g, " ").trim()); else addView(p);
    }
  } catch {}
  return NextResponse.json({ ok: true });
}
