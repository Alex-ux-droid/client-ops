// Конструктор кампаній Meta: кампанія → групи оголошень → оголошення + журнал навчання (усе, що робили і що вийшло)
import { db } from "../db";

export const OBJECTIVES = {
  leads: "Ліди (Leads)", sales: "Продажі (Sales)", traffic: "Трафік (Traffic)", engagement: "Взаємодія (Engagement)",
  awareness: "Впізнаваність (Awareness)", app: "Застосунок (App promotion)",
} as const;
export const CM_STATUS = { draft: "Чернетка", ready: "Готово до запуску", live: "Запущено", paused: "Пауза", done: "Завершено" } as const;
export const CONVERSIONS = { form: "Миттєва форма (лід-форма)", site: "Сайт", messenger: "Месенджери (Messenger / WhatsApp / Instagram)", call: "Дзвінки" } as const;
export const GENDERS = { all: "Усі", male: "Чоловіки", female: "Жінки" } as const;
// Формат креативу = розмір і тип (від нього залежить промпт і інструмент)
export const AD_FORMATS = {
  feed: "Фото 4:5 · 1080×1350", square: "Фото 1:1 · 1080×1080", story: "Фото 9:16 · 1080×1920", motion: "Моушен 9:16 · 6–10 с",
  video: "Відео 9:16 · 15–30 с", carousel: "Карусель 1:1 · 3–5 карток", wide: "16:9 · 1920×1080",
} as const;
export const isMotion = (f: string) => f === "motion" || f === "video";
export const CREATIVE_TOOLS = ["Claude"] as const;
export const AD_STATUS = { draft: "Чернетка", ready: "Готове", live: "У рекламі", off: "Вимкнено" } as const;
// Кнопки Meta: англійська назва як у кабінеті + наш переклад-підказка
export const CTAS = {
  LEARN_MORE: "Learn more · Докладніше", SIGN_UP: "Sign up · Зареєструватися", APPLY_NOW: "Apply now · Подати заявку",
  GET_QUOTE: "Get quote · Дізнатися ціну", CONTACT_US: "Contact us · Звʼязатися", SEND_MESSAGE: "Send message · Написати",
  CALL_NOW: "Call now · Подзвонити", BOOK_NOW: "Book now · Забронювати", SHOP_NOW: "Shop now · Купити", GET_OFFER: "Get offer · Отримати пропозицію",
  SUBSCRIBE: "Subscribe · Підписатися", DOWNLOAD: "Download · Завантажити",
} as const;
export const NOTE_KINDS = {
  note: { label: "Нотатка", ico: "📝" }, change: { label: "Зміна", ico: "🔧" }, budget: { label: "Бюджет", ico: "💰" },
  win: { label: "Зайшло", ico: "👍" }, lose: { label: "Не зайшло", ico: "👎" }, lesson: { label: "Урок", ico: "🎓" }, result: { label: "Результат", ico: "📊" },
} as const;
export type NoteKind = keyof typeof NOTE_KINDS;

export type Campaign = {
  id: number; client_id: number; name: string; objective: string; status: string; budget_level: string; budget_type: string; budget: number | null;
  start_date: string; end_date: string; idea: string; target_cpl: number | null; special_category: string; notes: string; meta_campaign_id: string;
  drive_folder_id: string; drive_folder_name: string; plan_json: string;
  created_at: string; updated_at: string;
};
export type AdSet = {
  id: number; campaign_id: number; name: string; conversion: string; form: string; url: string; budget: number | null; locations: string;
  age_min: number; age_max: number; gender: string; languages: string; interests: string; exclusions: string; audiences: string;
  advantage: number; placements: string; notes: string; sort: number; meta_adset_id: string; created_at: string;
};
export type Ad = {
  id: number; adset_id: number; name: string; angle: string; format: string; file_id: number | null; media_url: string; creative_id: number | null;
  creative_prompt: string; overlay: string; tool: string; files_json: string;
  primary_text: string; headline: string; description: string; variants_json: string; cta: string; url: string; utm: string;
  status: string; notes: string; sort: number; meta_ad_id: string; created_at: string;
};
export type CmNote = { id: number; campaign_id: number; adset_id: number | null; ad_id: number | null; kind: NoteKind; text: string; created_at: string };
export type Variants = { primary?: string[]; headline?: string[]; description?: string[]; tips?: string[] };

export const adCode = (a: { id: number }) => `AD-${a.id}`;
export const variantsOf = (a: Ad): Variants => { try { return JSON.parse(a.variants_json || "{}") as Variants; } catch { return {}; } };

const C_FIELDS = ["name", "objective", "status", "budget_level", "budget_type", "budget", "start_date", "end_date", "idea", "target_cpl", "special_category", "notes", "meta_campaign_id", "drive_folder_id", "drive_folder_name", "plan_json"] as const;
const S_FIELDS = ["name", "conversion", "form", "url", "budget", "locations", "age_min", "age_max", "gender", "languages", "interests", "exclusions", "audiences", "advantage", "placements", "notes", "sort", "meta_adset_id"] as const;
const A_FIELDS = ["name", "angle", "format", "creative_prompt", "overlay", "tool", "files_json", "file_id", "media_url", "creative_id", "primary_text", "headline", "description", "variants_json", "cta", "url", "utm", "status", "notes", "sort", "meta_ad_id"] as const;

function patchSql<T extends string>(table: string, fields: readonly T[], id: number, patch: Partial<Record<T, unknown>>, touch = false) {
  const keys = fields.filter((k) => k in patch);
  if (!keys.length) return;
  db().prepare(`UPDATE ${table} SET ${keys.map((k) => `${k} = @${k}`).join(", ")}${touch ? ", updated_at = datetime('now')" : ""} WHERE id = @id`)
    .run({ ...Object.fromEntries(keys.map((k) => [k, patch[k] ?? null])), id });
}

// ---------- кампанії
export const listCampaigns = (clientId: number) =>
  db().prepare(`SELECT c.*, (SELECT COUNT(*) FROM cm_adsets s WHERE s.campaign_id = c.id) AS adsets,
    (SELECT COUNT(*) FROM cm_ads a JOIN cm_adsets s ON s.id = a.adset_id WHERE s.campaign_id = c.id) AS ads
    FROM cm_campaigns c WHERE client_id = ? ORDER BY CASE status WHEN 'live' THEN 0 WHEN 'ready' THEN 1 WHEN 'draft' THEN 2 WHEN 'paused' THEN 3 ELSE 4 END, updated_at DESC`).all(clientId) as (Campaign & { adsets: number; ads: number })[];
export const getCampaign = (id: number) => db().prepare("SELECT * FROM cm_campaigns WHERE id = ?").get(id) as Campaign | undefined;
export function addCampaign(clientId: number, p: Partial<Campaign> = {}): number {
  const id = Number(db().prepare("INSERT INTO cm_campaigns (client_id, name) VALUES (?, ?)").run(clientId, p.name || "Нова кампанія").lastInsertRowid);
  patchSql("cm_campaigns", C_FIELDS, id, p);
  return id;
}
export const updateCampaign = (id: number, p: Partial<Campaign>) => patchSql("cm_campaigns", C_FIELDS, id, p, true);
export const deleteCampaign = (id: number) => db().prepare("DELETE FROM cm_campaigns WHERE id = ?").run(id);
const touch = (campaignId: number) => db().prepare("UPDATE cm_campaigns SET updated_at = datetime('now') WHERE id = ?").run(campaignId);

// ---------- групи
export const listAdsets = (campaignId: number) => db().prepare("SELECT * FROM cm_adsets WHERE campaign_id = ? ORDER BY sort, id").all(campaignId) as AdSet[];
export const getAdset = (id: number) => db().prepare("SELECT * FROM cm_adsets WHERE id = ?").get(id) as AdSet | undefined;
export function addAdset(campaignId: number, p: Partial<AdSet> = {}): number {
  const n = (db().prepare("SELECT COUNT(*) AS n FROM cm_adsets WHERE campaign_id = ?").get(campaignId) as { n: number }).n;
  const id = Number(db().prepare("INSERT INTO cm_adsets (campaign_id, name, sort) VALUES (?, ?, ?)").run(campaignId, p.name || `Група ${n + 1}`, n).lastInsertRowid);
  patchSql("cm_adsets", S_FIELDS, id, p);
  touch(campaignId);
  return id;
}
export function updateAdset(id: number, p: Partial<AdSet>) { patchSql("cm_adsets", S_FIELDS, id, p); const s = getAdset(id); if (s) touch(s.campaign_id); }
export const deleteAdset = (id: number) => db().prepare("DELETE FROM cm_adsets WHERE id = ?").run(id);

// ---------- оголошення
export const listAds = (adsetId: number) => db().prepare("SELECT * FROM cm_ads WHERE adset_id = ? ORDER BY sort, id").all(adsetId) as Ad[];
export const getAd = (id: number) => db().prepare("SELECT * FROM cm_ads WHERE id = ?").get(id) as Ad | undefined;
export const adsOfCampaign = (campaignId: number) =>
  db().prepare("SELECT a.* FROM cm_ads a JOIN cm_adsets s ON s.id = a.adset_id WHERE s.campaign_id = ? ORDER BY s.sort, s.id, a.sort, a.id").all(campaignId) as Ad[];
export function addAd(adsetId: number, p: Partial<Ad> = {}): number {
  const n = (db().prepare("SELECT COUNT(*) AS n FROM cm_ads WHERE adset_id = ?").get(adsetId) as { n: number }).n;
  const id = Number(db().prepare("INSERT INTO cm_ads (adset_id, sort) VALUES (?, ?)").run(adsetId, n).lastInsertRowid);
  const base = (p.name || p.angle || `Оголошення ${n + 1}`).replace(/^AD-\d+\s*·?\s*/, "");
  patchSql("cm_ads", A_FIELDS, id, { ...p, name: `AD-${id} · ${base}` });
  const s = getAdset(adsetId); if (s) touch(s.campaign_id);
  return id;
}
export function updateAd(id: number, p: Partial<Ad>) {
  if (p.name != null && !p.name.includes(`AD-${id}`)) p = { ...p, name: `AD-${id} · ${p.name.replace(/^AD-\d+\s*·?\s*/, "")}` };
  patchSql("cm_ads", A_FIELDS, id, p);
  const a = getAd(id); const s = a && getAdset(a.adset_id); if (s) touch(s.campaign_id);
}
export const deleteAd = (id: number) => db().prepare("DELETE FROM cm_ads WHERE id = ?").run(id);
export const campaignOfAd = (adId: number) => db().prepare("SELECT c.* FROM cm_campaigns c JOIN cm_adsets s ON s.campaign_id = c.id JOIN cm_ads a ON a.adset_id = s.id WHERE a.id = ?").get(adId) as Campaign | undefined;

// ---------- журнал навчання
export const listNotes = (campaignId: number) => db().prepare("SELECT * FROM cm_notes WHERE campaign_id = ? ORDER BY created_at DESC, id DESC").all(campaignId) as CmNote[];
export function addNote(campaignId: number, kind: NoteKind, text: string, ref: { adset_id?: number | null; ad_id?: number | null } = {}): number {
  const k = kind in NOTE_KINDS ? kind : "note";
  const id = Number(db().prepare("INSERT INTO cm_notes (campaign_id, adset_id, ad_id, kind, text) VALUES (?, ?, ?, ?, ?)").run(campaignId, ref.adset_id ?? null, ref.ad_id ?? null, k, text.trim()).lastInsertRowid);
  touch(campaignId);
  return id;
}
export const deleteNote = (id: number) => db().prepare("DELETE FROM cm_notes WHERE id = ?").run(id);
// Уроки й оцінки клієнта (для генерації і для Джері) + свіжі уроки з інших клієнтів
export const clientLessons = (clientId: number, limit = 30) =>
  db().prepare(`SELECT n.*, c.name AS campaign FROM cm_notes n JOIN cm_campaigns c ON c.id = n.campaign_id WHERE c.client_id = ? AND n.kind IN ('win','lose','lesson','result') ORDER BY n.created_at DESC LIMIT ?`).all(clientId, limit) as (CmNote & { campaign: string })[];
export const globalLessons = (exceptClient: number, limit = 12) =>
  db().prepare(`SELECT n.*, c.name AS campaign FROM cm_notes n JOIN cm_campaigns c ON c.id = n.campaign_id WHERE c.client_id != ? AND n.kind = 'lesson' ORDER BY n.created_at DESC LIMIT ?`).all(exceptClient, limit) as (CmNote & { campaign: string })[];

// Задум кампанії — думка Джері: загальна картина
export const PLAN_FIELDS = {
  goal: { label: "Ціль — що хочемо досягти", hint: "конкретно: скільки заявок/продажів, за яку ціну, за який час" },
  why_people: { label: "Чому це цікаво людям", hint: "біль, бажання, тригер — чому зупиняться на рекламі" },
  why_us: { label: "Навіщо ми її розвиваємо", hint: "місце в стратегії клієнта, що дає бізнесу" },
  potential: { label: "Потенціал", hint: "скільки можна вичавити при масштабуванні, куди рости" },
  risks: { label: "Ризики і що перевіряємо", hint: "гіпотези кампанії, що може не спрацювати" },
  kpi: { label: "Як міряємо успіх", hint: "цифри-пороги: коли масштабуємо, коли вимикаємо" },
} as const;
export type PlanKey = keyof typeof PLAN_FIELDS;
export const planOf = (c: Campaign): Partial<Record<PlanKey, string>> => { try { return JSON.parse(c.plan_json || "{}"); } catch { return {}; } };

// Картки каруселі (id файлів у порядку); для одиночного креативу — [file_id]
export const cardsOf = (a: Ad): number[] => {
  try { const v = JSON.parse(a.files_json || "[]"); if (Array.isArray(v) && v.length) return v.map(Number).filter(Boolean); } catch { /* ok */ }
  return a.file_id ? [a.file_id] : [];
};
export const hasMediaOf = (a: Ad) => cardsOf(a).length > 0 || !!a.media_url;
