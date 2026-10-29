import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";
import { NoKeyError, runAgent } from "@/lib/agent/run";
import { clearChat } from "@/lib/repo/chat";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

export async function POST(req: NextRequest) {
  if (!verifySession(req.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.json({ error: "Потрібен вхід" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { message?: string; clientId?: number | null; clear?: boolean };
  const clientId = Number(body.clientId) > 0 ? Number(body.clientId) : null;
  if (body.clear) { clearChat(clientId); return NextResponse.json({ ok: true }); }
  const message = String(body.message ?? "").trim();
  if (!message) return NextResponse.json({ error: "Порожнє повідомлення" }, { status: 400 });
  if (message.length > 100_000) return NextResponse.json({ error: "Задовгий текст (макс. 100 000 символів)" }, { status: 400 });

  try {
    return NextResponse.json(await runAgent(clientId, message));
  } catch (e) {
    const error =
      e instanceof NoKeyError ? "Нема ключа API. Додай його в Налаштуваннях." :
      e instanceof Anthropic.AuthenticationError ? "Ключ API не підходить. Перевір його в Налаштуваннях." :
      e instanceof Anthropic.PermissionDeniedError ? "Ключ не має доступу до цієї моделі." :
      e instanceof Anthropic.RateLimitError ? "Забагато запитів, спробуй за хвилину." :
      e instanceof Anthropic.BadRequestError ? `Помилка запиту: ${e.message}` :
      e instanceof Anthropic.APIError ? `Помилка API ${e.status ?? ""}: ${e.message}` :
      e instanceof Anthropic.APIConnectionError ? "Нема зв'язку з API." :
      "Щось пішло не так.";
    console.error("chat error", e);
    return NextResponse.json({ error }, { status: 500 });
  }
}
