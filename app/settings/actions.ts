"use server";
import Anthropic from "@anthropic-ai/sdk";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { agentConfig, saveAgentConfig, setAgentMemory } from "@/lib/agent/config";
import { requireUser } from "@/lib/auth";
import { disconnectGoogle, saveGoogleClient } from "@/lib/google";
import { CURRENCIES } from "@/lib/config";
import { setSetting } from "@/lib/repo/settings";
import { listVoices, saveVoiceChoice, saveVoiceKey } from "@/lib/voice";
import { connectBot, disconnectBot } from "@/lib/telegram";
import { linkChat } from "@/lib/repo/telegram";
import { createAgentToken, getApiKey, revokeAgentToken, saveApiKey } from "@/lib/secrets";

const back = (msg: string, ok = false, tab = "") => redirect(`/settings?${tab ? `tab=${tab}&` : ""}msg=${encodeURIComponent(msg)}${ok ? "&ok=1" : ""}`);

export async function saveKeyAction(fd: FormData) {
  await requireUser();
  const key = String(fd.get("key") ?? "").trim();
  if (!/^sk-ant-[\w-]{20,}$/.test(key)) back("Це не схоже на ключ Anthropic (має починатися з sk-ant-).", false, "access");
  saveApiKey(key);
  back("Ключ збережено. Натисни «Перевірити ключ».", true, "access");
}

export async function testKeyAction() {
  await requireUser();
  const key = getApiKey();
  if (!key) back("Ключа нема.", false, "access");
  const model = agentConfig().model;
  let msg = "";
  let ok = false;
  try {
    // Безкоштовна перевірка: інфо про модель
    const m = await new Anthropic({ apiKey: key! }).models.retrieve(model);
    msg = `Ключ працює. Модель: ${m.display_name}.`;
    ok = true;
  } catch (e) {
    msg = e instanceof Anthropic.AuthenticationError ? "Ключ не підходить." :
      e instanceof Anthropic.NotFoundError ? `Модель ${model} недоступна для цього ключа.` :
      e instanceof Anthropic.APIError ? `Помилка API: ${e.message}` : "Нема зв'язку з API.";
  }
  back(msg, ok, "access");
}

export async function saveAgentAction(fd: FormData) {
  await requireUser();
  saveAgentConfig({
    model: String(fd.get("model") ?? ""),
    effort: String(fd.get("effort") ?? ""),
    instructions: String(fd.get("instructions") ?? ""),
  });
  back("Налаштування помічника збережено.", true, "agent");
}

// Ключ доступу для Claude показується один раз — повертаємо його у форму, не в URL
export async function createAgentTokenAction(): Promise<string> {
  await requireUser();
  return createAgentToken();
}

export async function revokeAgentTokenAction() {
  await requireUser();
  revokeAgentToken();
  back("Доступ Claude вимкнено.", true, "access");
}

export async function saveGeneralAction(fd: FormData) {
  await requireUser();
  const cur = String(fd.get("currency") ?? "");
  if ((CURRENCIES as readonly string[]).includes(cur)) setSetting("currency", cur);
  back("Збережено.", true, "general");
}

export async function saveGoogleClientAction(fd: FormData) {
  await requireUser();
  const id = String(fd.get("client_id") ?? "").trim();
  const secret = String(fd.get("client_secret") ?? "").trim();
  if (!/\.apps\.googleusercontent\.com$/.test(id)) back("Client ID має закінчуватись на .apps.googleusercontent.com", false, "google");
  if (!secret && !process.env.GOOGLE_CLIENT_SECRET) back("Встав Client secret.", false, "google");
  saveGoogleClient(id, secret);
  back("Ключі Google збережено. Тепер натисни «Підключити Google».", true, "google");
}

export async function disconnectGoogleAction() {
  await requireUser();
  await disconnectGoogle();
  back("Google відключено.", true, "google");
}

export async function saveMemoryAction(fd: FormData) {
  await requireUser();
  setAgentMemory(String(fd.get("memory") ?? ""));
  back("Пам'ять помічника збережено.", true, "agent");
}

// ---- Голос (ElevenLabs)
export async function saveVoiceKeyAction(fd: FormData) {
  await requireUser();
  const key = String(fd.get("key") ?? "").trim();
  if (key.length < 20 || /\s/.test(key)) back("Ключ ElevenLabs виглядає неправильно.", false, "connectors&c=voice");
  saveVoiceKey(key);
  try {
    const voices = await listVoices();
    back(`Ключ працює: ${voices.length} голосів. Обери голос нижче.`, true, "connectors&c=voice");
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("NEXT_REDIRECT")) throw e;
    back(`Ключ збережено, але ElevenLabs відповів помилкою: ${e instanceof Error ? e.message : ""}`, false, "connectors&c=voice");
  }
}

export async function saveVoiceChoiceAction(fd: FormData) {
  await requireUser();
  const [id, ...name] = String(fd.get("voice") ?? "").split("|");
  if (!id) back("Обери голос.", false, "connectors&c=voice");
  saveVoiceChoice(id, name.join("|"), String(fd.get("model") ?? ""));
  back("Голос збережено. У чаті помічника увімкни кнопку «Голос».", true, "connectors&c=voice");
}

export async function disconnectVoiceAction() {
  await requireUser();
  saveVoiceKey(null);
  back("ElevenLabs відключено.", true, "connectors&c=voice");
}

// ---- Telegram
async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function connectTelegramAction(fd: FormData) {
  await requireUser();
  const token = String(fd.get("token") ?? "").trim();
  if (!/^\d+:[\w-]{30,}$/.test(token)) back("Токен має вигляд 123456789:AAE… — скопіюй його з @BotFather повністю.", false, "connectors&c=telegram");
  try {
    const me = await connectBot(token, await origin());
    back(`Бот @${me.username} підключений. Тепер прив'яжи свій Telegram кнопкою нижче.`, true, "connectors&c=telegram");
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("NEXT_REDIRECT")) throw e;
    back(e instanceof Error ? e.message : "Не вдалось підключити бота", false, "connectors&c=telegram");
  }
}

export async function disconnectTelegramAction() {
  await requireUser();
  await disconnectBot();
  back("Бота відключено.", true, "connectors&c=telegram");
}

export async function linkTelegramChatAction(fd: FormData) {
  await requireUser();
  const chatId = Number(fd.get("chat_id"));
  const clientId = Number(fd.get("client_id")) || null;
  if (chatId) linkChat(chatId, clientId);
  back(clientId ? "Групу прив'язано до клієнта — нові повідомлення підуть у його картку." : "Прив'язку знято.", true, "connectors&c=telegram");
}
