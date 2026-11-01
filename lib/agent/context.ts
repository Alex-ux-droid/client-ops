// Що Джері бачить сам, без «подивись»: відкрита задача (свіжий стан галочок) і знімок клієнта —
// реклама Meta (кабінет, кампанії з бюджетами, групи, активні креативи з текстами й цифрами, тривоги, останній розбір) і задачі в роботі.
// Збирається з бази на кожне повідомлення — завжди актуально. Тумблер auto.context.
import { getClientRow } from "../repo/clients";
import { accountsForClient, adsForClient, adsetsForClient, campaignsWithStats, getAnalysis, kyivDay, metaAlerts, totals } from "../repo/meta";
import { getTask, listTasks, taskItems, taskLinks } from "../repo/tasks";

const r2 = (n: number) => Math.round(n * 100) / 100;
const cpl = (s: number, l: number) => (l ? r2(s / l) : null);

export function taskSnapshot(taskId: number): { text: string; clientId: number | null } | null {
  const t = getTask(taskId);
  if (!t) return null;
  const items = taskItems(taskId);
  const links = taskLinks(taskId);
  const done = items.filter((i) => i.done).length;
  const lines = [
    `Задача #${t.id} «${t.title}»${t.client_name ? ` (клієнт ${t.client_name}, client_id ${t.client_id})` : ""} — статус ${t.status}${t.due_date ? `, дедлайн ${t.due_date}` : ""}${t.priority && t.priority !== "normal" ? `, пріоритет ${t.priority}` : ""}.`,
    items.length ? `Підзадачі (${done} з ${items.length} виконано, Саша відмічає сам — це актуальний стан):\n${items.map((i) => `${i.done ? "[x]" : "[ ]"} ${i.text} (item_id ${i.id})`).join("\n")}` : "Підзадач нема.",
    links.length ? `Посилання: ${links.map((l) => `${l.title || "посилання"} ${l.url}`).join("; ")}` : "",
    t.details ? `Інструкція (скорочено):\n${t.details.slice(0, 2500)}${t.details.length > 2500 ? "…" : ""}` : "",
  ];
  return { text: lines.filter(Boolean).join("\n"), clientId: t.client_id ?? null };
}

export function clientSnapshot(clientId: number): string {
  const c = getClientRow(clientId);
  if (!c) return "";
  const out: string[] = [];
  const accs = accountsForClient(clientId);
  if (accs.length) {
    const cur = accs[0].currency;
    const w = totals(clientId, kyivDay(6), kyivDay(0)), p = totals(clientId, kyivDay(13), kyivDay(7));
    out.push(`Meta Ads (дані синхронізуються самі кожні 2 год; валюта ${cur}): кабінет ${accs.map((a) => `${a.name}${a.last_sync_at ? `, оновлено ${a.last_sync_at.slice(0, 16)}` : ""}${a.last_error ? `, ПОМИЛКА: ${a.last_error}` : ""}`).join("; ")}.`);
    out.push(`7 днів: витрати ${r2(w.spend)}, ліди ${w.leads}, ціна ліда ${cpl(w.spend, w.leads) ?? "—"}; попередні 7: витрати ${r2(p.spend)}, ліди ${p.leads}, ціна ліда ${cpl(p.spend, p.leads) ?? "—"}.`);
    const camps = campaignsWithStats(clientId, kyivDay(29)).filter((x) => x.status === "ACTIVE" || x.spend > 0).slice(0, 10);
    if (camps.length) out.push(`Кампанії (30 днів):\n${camps.map((x) => `- «${x.name}» [${x.status}] ціль ${x.objective || "?"}${x.daily_budget ? `, бюджет ${x.daily_budget}/день` : ""} — витрати ${r2(x.spend)}, ліди ${x.leads}, ціна ліда ${cpl(x.spend, x.leads) ?? "—"}`).join("\n")}`);
    const sets = adsetsForClient(clientId).filter((x) => x.status === "ACTIVE" || x.spend_30d > 0).slice(0, 12);
    if (sets.length) out.push(`Групи оголошень:\n${sets.map((x) => `- «${x.name}» [${x.status}] оптимізація ${x.optimization_goal || "?"}${x.daily_budget ? `, ${x.daily_budget}/день` : ""} — 30д: ${r2(x.spend_30d)} витрат, ${x.leads_30d} лідів, частота ${x.reach_30d ? r2(x.impressions_30d / x.reach_30d) : "—"}`).join("\n")}`);
    const ads = adsForClient(clientId).filter((x) => x.status === "ACTIVE" || x.spend_30d > 0).slice(0, 15);
    if (ads.length) out.push(`Креативи (ad_id — щоб подивитись картинку через view_images):\n${ads.map((x) => `- ${x.ad_id} «${x.name}» [${x.status}, ${x.kind}] 30д: ${r2(x.spend_30d)} витрат, ${x.leads_30d} лідів, CTR ${x.impressions_30d ? r2((x.clicks_30d / x.impressions_30d) * 100) : "—"}%${x.body ? ` · текст: ${x.body.replace(/\s+/g, " ").slice(0, 140)}` : ""}`).join("\n")}`);
    const al = metaAlerts(clientId);
    if (al.length) out.push(`Тривоги: ${al.map((x) => x.text).join("; ")}`);
    const an = getAnalysis(clientId);
    if (an) out.push(`Останній розбір реклами (${an.created_at.slice(0, 10)}): ${an.data.summary}`);
    out.push("Лід-форми (питання, налаштування) система поки не тягне з Meta — про них питай Сашу.");
  } else out.push("Meta Ads: кабінет до клієнта не привʼязаний.");
  const tasks = listTasks("all", clientId).filter((t) => t.status !== "done").slice(0, 10);
  if (tasks.length) out.push(`Задачі в роботі:\n${tasks.map((t) => `- #${t.id} «${t.title}»${t.due_date ? ` до ${t.due_date}` : ""}${t.items_total ? ` — ${t.items_done}/${t.items_total} підзадач` : ""}`).join("\n")}`);
  return `Знімок клієнта «${c.name}» (актуальний на цю мить, з бази):\n${out.join("\n")}`;
}
