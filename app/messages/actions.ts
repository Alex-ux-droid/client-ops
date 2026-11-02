"use server";
// Повідомлення клієнтам: чернетка по шаблону, відправка в групу (тільки кнопкою Саші), редагування шаблонів
import { revalidatePath } from "next/cache";
import { capOn } from "@/lib/agent/caps";
import { requireUser } from "@/lib/auth";
import { draftClientMessage, MSG_RULES_DEFAULT } from "@/lib/clientMessage";
import { deleteMsgTemplate, listMsgTemplates, saveMsgTemplate } from "@/lib/repo/msgTemplates";
import { setSetting } from "@/lib/repo/settings";
import { chatsForClient } from "@/lib/repo/telegram";

export async function msgSetupAction(clientId: number) {
  await requireUser();
  return {
    on: capOn("client_msg"),
    canSend: capOn("groups"),
    templates: listMsgTemplates().map((t) => ({ id: t.id, title: t.title, when_hint: t.when_hint })),
    chats: chatsForClient(clientId).filter((c) => c.active).map((c) => ({ chat_id: c.chat_id, title: c.title })),
  };
}

export async function msgDraftAction(o: { clientId: number; taskId?: number | null; templateId: number; note?: string; previous?: string }) {
  await requireUser();
  if (!capOn("client_msg")) return { ok: false as const, error: "Вимкнено: Налаштування → Можливості → «Повідомлення клієнтам»" };
  return draftClientMessage(o);
}

export async function msgSendAction(clientId: number, chatId: number, text: string) {
  await requireUser();
  if (!capOn("groups")) return { ok: false, error: "Писати в групи вимкнено: Налаштування → Можливості" };
  const chat = chatsForClient(clientId).find((c) => c.chat_id === chatId && c.active);
  if (!chat) return { ok: false, error: "Група не привʼязана до клієнта" };
  if (!text.trim()) return { ok: false, error: "Порожнє повідомлення" };
  try {
    const { sendToGroup } = await import("@/lib/telegram");
    await sendToGroup(chatId, text.trim(), null);
    return { ok: true, chat: chat.title };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Не вдалось" };
  }
}

export async function saveMsgTemplateAction(fd: FormData) {
  await requireUser();
  const title = String(fd.get("title") ?? "").trim();
  if (!title) return;
  saveMsgTemplate({ id: Number(fd.get("id")) || undefined, title, when_hint: String(fd.get("when_hint") ?? "").trim(), guide: String(fd.get("guide") ?? "").trim(), example: String(fd.get("example") ?? "").trim() });
  revalidatePath("/settings");
}
export async function deleteMsgTemplateAction(fd: FormData) {
  await requireUser();
  deleteMsgTemplate(Number(fd.get("id")));
  revalidatePath("/settings");
}
export async function saveMsgRulesAction(fd: FormData) {
  await requireUser();
  const v = String(fd.get("rules") ?? "").trim();
  setSetting("msg.rules", v && v !== MSG_RULES_DEFAULT.trim() ? v : "");
  revalidatePath("/settings");
}
