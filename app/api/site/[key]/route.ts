import { NextResponse, type NextRequest } from "next/server";
import { ingestSite, productFromKey } from "@/lib/sitePulse";

// Пульс сайту: події зі скрипта на сайті клієнта (або з його серверної функції). Без сесії — ключ сайту в адресі.
// Відкрито для браузера (CORS, text/plain — без preflight).
const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type" };

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ key: string }> }) {
  const id = productFromKey((await ctx.params).key);
  if (!id) return NextResponse.json({ ok: false }, { status: 404, headers: CORS });
  const raw = await req.text();
  if (raw.length > 64_000) return NextResponse.json({ ok: false, error: "too large" }, { status: 413, headers: CORS });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ ok: false, error: "bad json" }, { status: 400, headers: CORS }); }
  const r = ingestSite(id, body);
  return NextResponse.json(r, { status: r.ok ? 200 : 429, headers: CORS });
}
