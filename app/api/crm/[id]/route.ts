import { NextResponse, type NextRequest } from "next/server";
import { crmWebhook } from "@/lib/crm";
import { logError } from "@/lib/log";

// Вебхук CRM клієнта: без сесії, перевірка — підпис X-Signature секретом CRM_SECRET_<id>
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const id = Number((await ctx.params).id);
  if (!id) return NextResponse.json({ ok: false }, { status: 404 });
  const raw = await req.text();
  if (raw.length > 512_000) return NextResponse.json({ ok: false, error: "too large" }, { status: 413 });
  try {
    const r = await crmWebhook(id, raw, req.headers);
    return NextResponse.json(r.body, { status: r.status });
  } catch (e) {
    logError(`crm-webhook ${id}`, e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
