"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { syncLeads } from "@/lib/metaLeads";
import { getLead, setLead, setPage } from "@/lib/repo/leads";
import { setSetting } from "@/lib/repo/settings";

export async function savePageAction(fd: FormData) {
  await requireUser();
  const id = String(fd.get("page_id") ?? "");
  const cid = Number(fd.get("client_id")) || null;
  setPage(id, { client_id: cid, leads_on: fd.get("leads_on") === "on" && cid ? 1 : 0 });
  revalidatePath("/settings");
}
export async function syncLeadsAction() {
  await requireUser();
  const r = await syncLeads({ manual: true });
  revalidatePath("/settings");
  revalidatePath("/clients");
  return r;
}
export async function leadsCopyOwnerAction(fd: FormData) {
  await requireUser();
  setSetting("leads.copy_owner", fd.get("copy") === "on" ? "on" : "off");
  revalidatePath("/settings");
}
export async function rateLeadAction(fd: FormData) {
  await requireUser();
  const l = getLead(Number(fd.get("id")));
  if (!l) return;
  const q = String(fd.get("q") ?? "");
  if (q === "good" || q === "bad" || q === "") setLead(l.id, { quality: l.quality === q ? "" : (q as "good" | "bad" | ""), quality_by: "Саша" });
  revalidatePath(`/clients/${l.client_id}`);
}

// ── Куди йдуть заявки клієнта: група / власний бот клієнта
export async function leadRouteAction(fd: FormData) {
  await requireUser();
  const cid = Number(fd.get("client_id"));
  const { saveRoute } = await import("@/lib/repo/leads");
  saveRoute(cid, { to_group: fd.get("to_group") === "on" ? 1 : 0, to_bot: fd.get("to_bot") === "on" ? 1 : 0 });
  revalidatePath(`/clients/${cid}`);
}
export async function leadBotConnectAction(clientId: number, token: string, force: boolean) {
  await requireUser();
  const { headers } = await import("next/headers");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const { connectLeadBot } = await import("@/lib/leadBot");
  const r = await connectLeadBot(clientId, token, `${proto}://${host}`, force);
  revalidatePath(`/clients/${clientId}`);
  return r;
}
export async function leadBotDisconnectAction(fd: FormData) {
  await requireUser();
  const cid = Number(fd.get("client_id"));
  const { disconnectLeadBot } = await import("@/lib/leadBot");
  await disconnectLeadBot(cid);
  revalidatePath(`/clients/${cid}`);
}
export async function leadBotInviteAction(fd: FormData) {
  await requireUser();
  const cid = Number(fd.get("client_id"));
  const { newInvite } = await import("@/lib/leadBot");
  newInvite(cid);
  revalidatePath(`/clients/${cid}`);
}
export async function leadBotUserAction(fd: FormData) {
  await requireUser();
  const cid = Number(fd.get("client_id"));
  const { setBotUserActive } = await import("@/lib/repo/leads");
  setBotUserActive(cid, Number(fd.get("tg_user_id")), false);
  revalidatePath(`/clients/${cid}`);
}
export async function leadBotTestAction(clientId: number) {
  await requireUser();
  const { leadBotToken } = await import("@/lib/leadBot");
  const { botUsers } = await import("@/lib/repo/leads");
  const { tgCall } = await import("@/lib/telegram");
  const token = leadBotToken(clientId);
  const users = botUsers(clientId);
  if (!token) return { ok: false, text: "Бот не підключений" };
  if (!users.length) return { ok: false, text: "Ще ніхто не підписався — відкрий посилання-запрошення в Telegram" };
  let ok = 0;
  for (const u of users) await tgCall(token, "sendMessage", { chat_id: u.tg_user_id, text: "🧪 Тестова заявка\n\n👤 Іван Тест\n📞 +380 00 000 00 00\n• Що цікавить: перевірка звʼязку\n\nЯкщо бачите це — заявки з реклами будуть приходити сюди." }).then(() => ok++).catch(() => {});
  return { ok: ok > 0, text: `Надіслано ${ok} з ${users.length}` };
}
