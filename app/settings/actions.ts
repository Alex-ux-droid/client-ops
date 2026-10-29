"use server";
import Anthropic from "@anthropic-ai/sdk";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { agentModel, getApiKey, saveApiKey } from "@/lib/secrets";

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
  let msg = "";
  let ok = false;
  try {
    // Безкоштовна перевірка: інфо про модель
    const m = await new Anthropic({ apiKey: key! }).models.retrieve(agentModel());
    msg = `Ключ працює. Модель: ${m.display_name}.`;
    ok = true;
  } catch (e) {
    msg = e instanceof Anthropic.AuthenticationError ? "Ключ не підходить." :
      e instanceof Anthropic.NotFoundError ? `Модель ${agentModel()} недоступна для цього ключа.` :
      e instanceof Anthropic.APIError ? `Помилка API: ${e.message}` : "Нема зв'язку з API.";
  }
  back(msg, ok);
}
