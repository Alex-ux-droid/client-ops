// Моніторинг продакшену стартапів: раз на 5 хв запит на prod_url. Два збої поспіль — повідомлення Саші в Telegram,
// відновився — теж. Тумблер: Налаштування → «Можливості» → «Моніторинг стартапів».
import { autoOn } from "./agent/caps";
import { logError } from "./log";
import { getSetting, setSetting } from "./repo/settings";
import { addCheck, monitoredStartups } from "./repo/startups";

export async function checkUrl(url: string): Promise<{ ok: boolean; status: number; ms: number }> {
  const t = Date.now();
  try {
    const r = await fetch(url, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(10000), headers: { "user-agent": "client-ops-monitor" } });
    return { ok: r.status < 400, status: r.status, ms: Date.now() - t };
  } catch {
    return { ok: false, status: 0, ms: Date.now() - t };
  }
}

export async function monitorTick(): Promise<void> {
  if (!autoOn("startup_monitor")) return;
  const now = Date.now();
  if (now - Number(getSetting("su.monitor_last") || 0) < 5 * 60_000 - 5000) return;
  setSetting("su.monitor_last", String(now));
  for (const s of monitoredStartups()) {
    const r = await checkUrl(s.prod_url);
    addCheck(s.id, r.ok, r.status, r.ms);
    const fails = r.ok ? 0 : Number(getSetting(`su.fails.${s.id}`) || 0) + 1;
    setSetting(`su.fails.${s.id}`, String(fails));
    const down = getSetting(`su.down.${s.id}`) === "1";
    if (fails >= 2 && !down) { setSetting(`su.down.${s.id}`, "1"); await notify(`🔴 ${s.name}: сайт не відповідає (${r.status || "нема звʼязку"})\n${s.prod_url}`); }
    if (r.ok && down) { setSetting(`su.down.${s.id}`, ""); await notify(`🟢 ${s.name}: сайт знову працює (${r.ms} мс)`); }
  }
}

async function notify(text: string) {
  try {
    const { tg, tgOwner } = await import("./telegram");
    const owner = tgOwner();
    if (owner) await tg("sendMessage", { chat_id: owner, text });
  } catch (e) { logError("startup-monitor", e); }
}
