import { timingSafeEqual } from "node:crypto";
import { after, NextResponse, type NextRequest } from "next/server";
import { handleLeadBotUpdate, leadBotSecret, leadBotToken } from "@/lib/leadBot";
import { logError } from "@/lib/log";

// Вебхук власного бота клієнта (заявки). Без сесії — перевіряємо секрет, який дали Telegram у setWebhook.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const id = Number((await ctx.params).id);
  const secret = id && leadBotToken(id) ? leadBotSecret(id) : "";
  const got = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!secret || got.length !== secret.length || !timingSafeEqual(Buffer.from(got), Buffer.from(secret))) return NextResponse.json({ ok: false }, { status: 401 });
  const u = await req.json().catch(() => null);
  if (u) after(() => handleLeadBotUpdate(id, u).catch((e) => logError("leadbot", e)));
  return NextResponse.json({ ok: true });
}
