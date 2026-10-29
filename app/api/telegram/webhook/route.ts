import { timingSafeEqual } from "node:crypto";
import { after, NextResponse, type NextRequest } from "next/server";
import { logError } from "@/lib/log";
import { handleUpdate, tgSecret, type TgUpdate } from "@/lib/telegram";

// Вебхук Telegram. Вхід без сесії — перевіряємо секрет, який ми самі дали Telegram у setWebhook.
export async function POST(req: NextRequest) {
  const secret = tgSecret();
  const got = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!secret || got.length !== secret.length || !timingSafeEqual(Buffer.from(got), Buffer.from(secret))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const update = (await req.json().catch(() => null)) as TgUpdate | null;
  // Відповідаємо Telegram одразу, а обробляємо після (розшифровка голосу і помічник — це секунди)
  if (update) after(() => handleUpdate(update).catch((e) => logError("telegram", e)));
  return NextResponse.json({ ok: true });
}
