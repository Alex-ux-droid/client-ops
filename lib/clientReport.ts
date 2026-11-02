// Звіт для клієнта: публічна сторінка /r/<токен> (без входу, тільки читання) і тижнева чернетка звіту Саші в Telegram.
import { createHmac, timingSafeEqual } from "node:crypto";
import { autoOn } from "./agent/caps";
import { draftClientMessage } from "./clientMessage";
import { logError } from "./log";
import { getClient, listClients } from "./repo/clients";
import { listChanges } from "./repo/creatives";
import { leadStats } from "./repo/leads";
import { accountsForClient, kyivDay, totals } from "./repo/meta";
import { listMsgTemplates } from "./repo/msgTemplates";
import { getSetting, setSetting } from "./repo/settings";

// Посилання вмикається для клієнта окремо; «нове посилання» = версія +1 (старе перестає працювати)
const ver = (id: number) => Number(getSetting(`report.public.${id}`) || 0);
const sig = (id: number, v: number) => createHmac("sha256", process.env.SESSION_SECRET || "client-ops").update(`client-report:${id}:${v}`).digest("base64url").slice(0, 22);
export function reportToken(id: number): string | null {
  const v = ver(id);
  return v > 0 ? `${id}-${sig(id, v)}` : null;
}
export function clientFromToken(token: string): number | null {
  const m = token.match(/^(\d+)-([\w-]{22})$/);
  if (!m) return null;
  const id = Number(m[1]), v = ver(id);
  if (v <= 0) return null;
  const a = Buffer.from(m[2]), b = Buffer.from(sig(id, v));
  return a.length === b.length && timingSafeEqual(a, b) ? id : null;
}
export function setReportLink(id: number, on: boolean, renew = false): void {
  const v = ver(id);
  setSetting(`report.public.${id}`, String(!on ? -Math.abs(v || 1) : renew || v <= 0 ? Math.abs(v) + 1 : v));
}

// Понеділок, 10:00 за Києвом: чернетка тижневого звіту по рекламі для кожного клієнта з витратами — Саші в Telegram
export async function weeklyReportTick(): Promise<void> {
  if (!autoOn("weekly_report")) return;
  const now = new Date();
  const kyiv = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Kyiv" }));
  if (kyiv.getDay() !== 1 || kyiv.getHours() < 10) return;
  const day = kyivDay(0);
  if (getSetting("report.weekly_last") === day) return;
  setSetting("report.weekly_last", day);
  const tpl = listMsgTemplates().find((t) => /звіт/i.test(t.title));
  if (!tpl) return;
  const { tg, tgOwner } = await import("./telegram");
  const owner = tgOwner();
  if (!owner) return;
  for (const c of listClients().filter((x) => x.status === "active")) {
    if (!accountsForClient(c.id).length) continue;
    const w = totals(c.id, kyivDay(6), kyivDay(0));
    if (w.spend <= 0) continue;
    const ls = leadStats(c.id, 7);
    const ch = listChanges(c.id, 10).filter((x) => x.at >= kyivDay(13));
    const note = [`Тижневий звіт за останні 7 днів.`, ls.total ? `Заявки з форм: ${ls.total}, взяли в роботу ${ls.taken}, якісних ${ls.good}, сміття ${ls.bad}.` : "", ch.length ? `Що ми змінили: ${ch.map((x) => `${x.what}${x.result ? ` → ${x.result}` : ""}`).join("; ")}.` : "", "Закінчи тим, що плануємо на наступний тиждень (з порад розбору)."].filter(Boolean).join(" ");
    try {
      const r = await draftClientMessage({ clientId: c.id, templateId: tpl.id, note });
      if (!r.ok) continue;
      const link = reportToken(c.id);
      await tg("sendMessage", { chat_id: owner, text: `📊 Чернетка тижневого звіту для «${c.name}»:\n\n${r.text}${link ? "\n\n(посилання на звіт для клієнта — у картці: Meta → «Звіт для клієнта»)" : ""}\n\n— перевір, підправ і перешли клієнту.` });
    } catch (e) { logError("weekly-report", e); }
  }
}

export const clientName = (id: number) => getClient(id)?.name ?? "";
