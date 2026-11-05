import { NextResponse, type NextRequest } from "next/server";
import { logError } from "@/lib/log";
import { appWebhook } from "@/lib/products";

// Події від наших програм (Client Ops Connect): без сесії, перевірка — підпис секретом APP_SECRET_<id>
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const id = Number((await ctx.params).id);
  if (!id) return NextResponse.json({ ok: false }, { status: 404 });
  const raw = await req.text();
  if (raw.length > 256_000) return NextResponse.json({ ok: false, error: "too large" }, { status: 413 });
  try {
    const r = await appWebhook(id, raw, req.headers);
    return NextResponse.json(r.body, { status: r.status });
  } catch (e) {
    logError(`app-webhook ${id}`, e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
