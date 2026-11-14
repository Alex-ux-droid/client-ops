import { NextResponse, type NextRequest } from "next/server";
import { addView, normPath } from "@/lib/repo/pageViews";

// Лічильник відкритих розділів (proxy пропускає сюди тільки з сесією)
export async function POST(req: NextRequest) {
  if (req.headers.get("authorization")) return NextResponse.json({ ok: true }); // перевірки Claude (Bearer) не рахуємо
  try {
    const { path, search } = (await req.json()) as { path?: string; search?: string };
    if (path && path.startsWith("/") && !path.startsWith("/api")) addView(normPath(path, search ?? ""));
  } catch {}
  return NextResponse.json({ ok: true });
}
