import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { ingestReport, reportKey } from "@/lib/startupIssues";

// Звіти про помилки/відгуки від продуктів, які ми будуємо (стартапи). Без сесії — ключ проєкту в Authorization.
// Відкрито для браузера (CORS), бо кнопка «Щось не працює» може слати прямо зі сторінки продукту.
const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type, authorization" };

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const id = Number((await ctx.params).id);
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const key = id ? reportKey(id) : "";
  if (!key || got.length !== key.length || !timingSafeEqual(Buffer.from(got), Buffer.from(key))) return NextResponse.json({ ok: false }, { status: 401, headers: CORS });
  const raw = await req.text();
  if (raw.length > 64_000) return NextResponse.json({ ok: false, error: "too large" }, { status: 413, headers: CORS });
  let body: Record<string, unknown> = {};
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ ok: false, error: "bad json" }, { status: 400, headers: CORS }); }
  const r = await ingestReport(id, body);
  return NextResponse.json(r, { status: r.ok ? 200 : r.error === "rate limit" ? 429 : 404, headers: CORS });
}
