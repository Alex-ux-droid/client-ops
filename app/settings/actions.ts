"use server";
import Anthropic from "@anthropic-ai/sdk";
import { redirect } from "next/navigation";
import { agentConfig, saveAgentConfig } from "@/lib/agent/config";
import { requireUser } from "@/lib/auth";
import { createAgentToken, getApiKey, revokeAgentToken, saveApiKey } from "@/lib/secrets";

const back = (msg: string, ok = false) => redirect(`/settings?msg=${encodeURIComponent(msg)}${ok ? "&ok=1" : ""}`);

export async function saveKeyAction(fd: FormData) {
  await requireUser();
  const key = String(fd.get("key") ?? "").trim();
  if (!/^sk-ant-[\w-]{20,}$/.test(key)) back("Це не схоже на ключ Anthropic (має починатися з sk-ant-).");
  saveApiKey(key);
  back("Ключ збережено. Натисни «Перевірити ключ».", true);
}

export async function testKeyAction() {
  await requireUser();
  const key = getApiKey();
  if (!key) back("Ключа нема.");
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
  back(msg, ok);
}

export async function saveAgentAction(fd: FormData) {
  await requireUser();
  saveAgentConfig({
    model: String(fd.get("model") ?? ""),
    effort: String(fd.get("effort") ?? ""),
    instructions: String(fd.get("instructions") ?? ""),
  });
  back("Налаштування помічника збережено.", true);
}

// Ключ доступу для Claude показується один раз — повертаємо його у форму, не в URL
export async function createAgentTokenAction(): Promise<string> {
  await requireUser();
  return createAgentToken();
}

export async function revokeAgentTokenAction() {
  await requireUser();
  revokeAgentToken();
  back("Доступ Claude вимкнено.", true);
}
