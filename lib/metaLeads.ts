// Заявки з лід-форм Meta → база → Telegram-група клієнта (кнопки «Взяли / Якісна / Сміття»).
// Без вебхуків Meta: раз на хвилину питаємо нові заявки по кожній формі сторінки (токен сторінки з me/accounts).
// Потрібні дозволи токена: leads_retrieval, pages_show_list, pages_read_engagement, pages_manage_ads (+ ads_read для цифр).
import { autoOn } from "./agent/caps";
import { logError } from "./log";
import { metaAll, metaGet, metaToken } from "./meta";
import { getClient } from "./repo/clients";
import { clientByAd, getLead, getPage, insertLead, leadFields, leadsToRemind, listPages, setLead, setPage, upsertForm, upsertPage, type Lead, type LeadField } from "./repo/leads";
import { getSetting, setSetting } from "./repo/settings";
import { chatsForClient } from "./repo/telegram";

export const LEAD_PERMS = ["leads_retrieval", "pages_show_list", "pages_read_engagement", "pages_manage_ads"];
const STD: Record<string, string> = { full_name: "Імʼя", first_name: "Імʼя", last_name: "Прізвище", phone_number: "Телефон", email: "Email", city: "Місто", country: "Країна", zip_code: "Індекс", street_address: "Адреса", company_name: "Компанія", job_title: "Посада", date_of_birth: "Дата народження" };

type Page = { id: string; name: string; access_token?: string };
type Form = { id: string; name: string; status: string; questions?: { key: string; label?: string; type?: string }[] };
type RawLead = { id: string; created_time: string; field_data?: { name: string; values?: string[] }[]; ad_id?: string; ad_name?: string; adset_name?: string; campaign_name?: string; form_id?: string; platform?: string };

let running = false;
let pauseUntil = 0;
let formsAt = 0;
const formsCache = new Map<string, Form[]>(); // page_id → форми

// Яких дозволів бракує токену (null — не вдалось перевірити)
export async function missingLeadPerms(): Promise<string[] | null> {
  try {
    const r = await metaGet<{ data?: { permission: string; status: string }[] }>("me/permissions");
    const granted = new Set((r.data ?? []).filter((p) => p.status === "granted").map((p) => p.permission));
    return LEAD_PERMS.filter((p) => !granted.has(p));
  } catch { return null; }
}

function parseLead(raw: RawLead, form: Form | undefined): { name: string; phone: string; email: string; fields: LeadField[] } {
  const labels = new Map((form?.questions ?? []).map((q) => [q.key, q.label || STD[q.type?.toLowerCase() ?? ""] || ""]));
  let name = "", first = "", last = "", phone = "", email = "";
  const fields: LeadField[] = [];
  for (const f of raw.field_data ?? []) {
    const value = (f.values ?? []).join(", ").replace(/_/g, " ").trim();
    if (!value) continue;
    const k = f.name.toLowerCase();
    if (k === "full_name") { name = value; continue; }
    if (k === "first_name") { first = value; continue; }
    if (k === "last_name") { last = value; continue; }
    if (k === "phone_number" || k === "phone") { phone = value; continue; }
    if (k === "email") { email = value; continue; }
    const label = (labels.get(f.name) || STD[k] || f.name.replace(/_/g, " ")).replace(/[?:\s]+$/, "").trim();
    fields.push({ label: label.charAt(0).toUpperCase() + label.slice(1), value });
  }
  return { name: name || [first, last].filter(Boolean).join(" "), phone, email, fields };
}

const kyiv = (iso: string) => new Date(iso).toLocaleString("uk-UA", { timeZone: "Europe/Kyiv", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export function leadText(l: Lead): string {
  const c = l.client_id ? getClient(l.client_id) : undefined;
  const status = [
    l.taken_at ? `✅ Взяли в роботу${l.taken_by ? ` — ${l.taken_by}` : ""}` : "",
    l.quality === "good" ? `👍 Якісна${l.quality_by ? ` (${l.quality_by})` : ""}` : l.quality === "bad" ? `👎 Сміття${l.quality_by ? ` (${l.quality_by})` : ""}` : "",
  ].filter(Boolean);
  return [
    `🔥 Нова заявка${c ? ` · ${c.name}` : ""}`,
    "",
    l.name && `👤 ${l.name}`,
    l.phone && `📞 ${l.phone}`,
    l.email && `✉️ ${l.email}`,
    ...leadFields(l).map((f) => `• ${f.label}: ${f.value}`),
    "",
    [l.campaign_name, l.ad_name].filter(Boolean).length ? `📣 ${[l.campaign_name, l.ad_name].filter(Boolean).join(" / ")}` : `📣 ${l.form_name || "форма Meta"}`,
    `🕒 ${kyiv(l.created_time)}`,
    status.length ? `\n${status.join("\n")}` : "",
  ].filter((x): x is string => typeof x === "string").join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function leadKeyboard(l: Lead) {
  const rows: { text: string; callback_data: string }[][] = [];
  if (!l.taken_at) rows.push([{ text: "✅ Взяли в роботу", callback_data: `ld:${l.id}:t` }]);
  rows.push([
    { text: l.quality === "good" ? "👍 Якісна ✓" : "👍 Якісна", callback_data: `ld:${l.id}:g` },
    { text: l.quality === "bad" ? "👎 Сміття ✓" : "👎 Сміття", callback_data: `ld:${l.id}:b` },
  ]);
  return { inline_keyboard: rows };
}

async function notify(id: number): Promise<void> {
  const l = getLead(id);
  if (!l) return;
  const { tg, tgOwner } = await import("./telegram");
  const page = getPage(l.page_id);
  const groups = l.client_id && page?.leads_on ? chatsForClient(l.client_id).filter((c) => c.active) : [];
  type Sent = { message_id: number };
  let first: { chat: number; msg: number } | null = null;
  for (const g of groups) {
    const r = await tg<Sent>("sendMessage", { chat_id: g.chat_id, text: leadText(l), reply_markup: leadKeyboard(l) }).catch((e) => { logError("leads-tg", e); return null; });
    if (r && !first) first = { chat: g.chat_id, msg: r.message_id };
  }
  const owner = tgOwner();
  const copy = getSetting("leads.copy_owner") === "on";
  if (owner && (copy || (!first && page?.leads_on))) {
    const why = !l.client_id ? "\n\n⚠️ Не знаю, чий це клієнт — привʼяжи сторінку в Налаштування → Конектори → Meta." : !groups.length && page?.leads_on ? "\n\n⚠️ У клієнта нема Telegram-групи з ботом — тому шлю тобі." : "";
    await tg("sendMessage", { chat_id: owner, text: leadText(l) + why }).catch((e) => logError("leads-tg", e));
  }
  setLead(id, { notified_at: new Date().toISOString().slice(0, 19).replace("T", " "), ...(first ? { tg_chat_id: first.chat, tg_message_id: first.msg } : {}) });
}

export async function syncLeads(opts: { manual?: boolean } = {}): Promise<{ added: number; error?: string }> {
  if (running || !metaToken() || (!opts.manual && (!autoOn("leads") || Date.now() < pauseUntil))) return { added: 0 };
  running = true;
  let added = 0;
  try {
    const pages = await metaAll<Page>("me/accounts", { fields: "id,name,access_token", limit: "100" });
    for (const p of pages) upsertPage(p.id, p.name);
    const refreshForms = opts.manual || Date.now() - formsAt > 30 * 60_000;
    for (const p of pages) {
      if (!p.access_token) continue;
      const row = getPage(p.id);
      try {
        if (refreshForms || !formsCache.has(p.id)) {
          const forms = await metaAll<Form>(`${p.id}/leadgen_forms`, { fields: "id,name,status,questions", limit: "100" }, p.access_token);
          formsCache.set(p.id, forms);
          for (const f of forms) upsertForm({ form_id: f.id, page_id: p.id, name: f.name, status: f.status, questions_json: JSON.stringify(f.questions ?? []) });
        }
        const forms = (formsCache.get(p.id) ?? []).filter((f) => f.status === "ACTIVE" || refreshForms);
        const backfill = !row?.last_lead_time;
        const sinceIso = row?.last_lead_time ?? new Date(Date.now() - 30 * 86400_000).toISOString();
        const since = Math.floor(new Date(sinceIso).getTime() / 1000) - 120; // перекриття 2 хв — дублі відсіє UNIQUE
        let newest = sinceIso;
        for (const f of forms) {
          const params = { fields: "id,created_time,field_data,ad_id,ad_name,adset_name,campaign_name,form_id,platform", limit: "100", filtering: JSON.stringify([{ field: "time_created", operator: "GREATER_THAN", value: since }]) };
          const raws = await metaAll<RawLead>(`${f.id}/leads`, params, p.access_token);
          for (const raw of raws.sort((a, b) => a.created_time.localeCompare(b.created_time))) {
            const created = new Date(raw.created_time).toISOString();
            if (created > newest) newest = created;
            const parsed = parseLead(raw, f);
            const id = insertLead({
              lead_id: raw.id, client_id: clientByAd(raw.ad_id ?? "") ?? row?.client_id ?? null, page_id: p.id, form_id: f.id, form_name: f.name,
              ad_id: raw.ad_id ?? "", ad_name: raw.ad_name ?? "", adset_name: raw.adset_name ?? "", campaign_name: raw.campaign_name ?? "", platform: raw.platform ?? "",
              created_time: created, name: parsed.name, phone: parsed.phone, email: parsed.email, fields_json: JSON.stringify(parsed.fields),
              notified_at: backfill ? "backfill" : null,
            });
            if (id) { added++; if (!backfill) await notify(id); }
          }
        }
        setPage(p.id, { last_lead_time: backfill && newest === sinceIso ? new Date().toISOString() : newest, last_error: "" });
      } catch (e) {
        setPage(p.id, { last_error: e instanceof Error ? e.message : String(e) });
      }
    }
    if (refreshForms) formsAt = Date.now();
    setSetting("leads.last_sync", new Date().toISOString());
    setSetting("leads.last_error", "");
    return { added };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // у журнал — тільки нова помилка (а не щохвилини та сама), і пауза 15 хв перед наступною спробою
    if (!opts.manual && getSetting("leads.last_error") !== msg) logError("leads", e);
    setSetting("leads.last_error", msg);
    pauseUntil = Date.now() + 15 * 60_000;
    return { added, error: msg };
  } finally {
    running = false;
  }
}

// Кнопки під заявкою в Telegram
export async function leadCallback(q: { id: string; data?: string; from?: { first_name?: string; last_name?: string; username?: string }; message?: { chat: { id: number }; message_id: number } }): Promise<void> {
  const { tg } = await import("./telegram");
  const m = q.data?.match(/^ld:(\d+):([tgb])$/);
  const l = m ? getLead(Number(m[1])) : undefined;
  if (!m || !l || !q.message || l.tg_chat_id !== q.message.chat.id) { await tg("answerCallbackQuery", { callback_query_id: q.id }).catch(() => {}); return; }
  const who = [q.from?.first_name, q.from?.last_name].filter(Boolean).join(" ") || q.from?.username || "";
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  if (m[2] === "t" && !l.taken_at) setLead(l.id, { taken_at: now, taken_by: who });
  if (m[2] === "g") setLead(l.id, { quality: l.quality === "good" ? "" : "good", quality_by: l.quality === "good" ? "" : who, ...(l.taken_at ? {} : { taken_at: now, taken_by: who }) });
  if (m[2] === "b") setLead(l.id, { quality: l.quality === "bad" ? "" : "bad", quality_by: l.quality === "bad" ? "" : who, ...(l.taken_at ? {} : { taken_at: now, taken_by: who }) });
  const u = getLead(l.id)!;
  await tg("editMessageText", { chat_id: q.message.chat.id, message_id: q.message.message_id, text: leadText(u), reply_markup: leadKeyboard(u) }).catch(() => {});
  await tg("answerCallbackQuery", { callback_query_id: q.id, text: m[2] === "t" ? "Записав: взяли в роботу" : "Оцінку записав" }).catch(() => {});
}

// Нагадування: на заявку 15 хв ніхто не відреагував (тільки 8:00–22:00 за Києвом)
export async function leadsRemindTick(): Promise<void> {
  if (!autoOn("leads_remind")) return;
  const h = Number(new Date().toLocaleString("en-GB", { timeZone: "Europe/Kyiv", hour: "2-digit", hour12: false }));
  if (h < 8 || h >= 22) return;
  const { tg } = await import("./telegram");
  for (const l of leadsToRemind()) {
    setLead(l.id, { reminded_at: new Date().toISOString().slice(0, 19).replace("T", " ") });
    await tg("sendMessage", { chat_id: l.tg_chat_id, reply_to_message_id: l.tg_message_id, text: `⏰ На заявку${l.name ? ` від ${l.name}` : ""} ще ніхто не відповів. Чим швидше дзвінок — тим вищий шанс продажу. Хто набере? Натисніть «Взяли в роботу».` }).catch((e) => logError("leads-remind", e));
  }
}

// Щохвилинний tick
let lastTick = 0;
export async function leadsTick(): Promise<void> {
  if (Date.now() - lastTick < 55_000) return;
  lastTick = Date.now();
  await syncLeads();
  await leadsRemindTick();
}
