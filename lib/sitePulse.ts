// Пульс сайту: прийом подій зі скрипта на сайті (без сесії, публічний ключ сайту), зведення для екрана, Джері і промпт підключення.
import { createHash, createHmac } from "node:crypto";
import { db } from "./db";
import { addProductEvent, getProduct, productCode } from "./repo/products";
import { autoOn } from "./agent/caps";
import { logError } from "./log";
import { getSetting, setSetting } from "./repo/settings";

export const SITE_KINDS = ["view", "click", "form_start", "form_submit", "form_success", "form_error", "scroll", "js_error"] as const;
type Kind = (typeof SITE_KINDS)[number];

// Публічний ключ сайту: «<id>-<hmac>». Лежить у коді сайту відкрито — він дає право лише писати події цього сайту.
const sig = (id: number) => createHmac("sha256", process.env.SESSION_SECRET || process.env.TELEGRAM_WEBHOOK_SECRET || "client-ops").update(`site-pulse:${id}`).digest("hex").slice(0, 20);
export const siteKey = (id: number) => `${id}-${sig(id)}`;
export function productFromKey(key: string): number | null {
  const m = key.match(/^(\d+)-([0-9a-f]{20})$/);
  if (!m) return null;
  const id = Number(m[1]);
  return sig(id) === m[2] && getProduct(id) ? id : null;
}

const hits = new Map<number, { n: number; at: number }>();
function allowed(id: number, add: number): boolean {
  const now = Date.now(), h = hits.get(id);
  if (!h || now - h.at > 60_000) { hits.set(id, { n: add, at: now }); return true; }
  h.n += add;
  return h.n <= 3000; // ~50 подій/с на сайт — більше вже атака або зациклення
}

const cut = (v: unknown, n: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
// Нічого особистого: прибираємо телефони, пошти, довгі числа
const scrub = (s: string) => s.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email]").replace(/\+?\d[\d\s()-]{7,}\d/g, "[номер]");

export function ingestSite(productId: number, body: unknown): { ok: boolean; error?: string; n?: number } {
  const b = (body ?? {}) as Record<string, unknown>;
  const list = (Array.isArray(b.events) ? b.events : [b]).slice(0, 60) as Record<string, unknown>[];
  if (!allowed(productId, list.length)) return { ok: false, error: "rate limit" };
  const source = cut(b.source, 60), session = cut(b.session, 40), device = b.device === "mobile" ? "mobile" : "desktop";
  const ins = db().prepare("INSERT INTO site_events (product_id, at, kind, page, label, source, session, device) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
  let n = 0;
  const errs: { label: string; page: string }[] = [];
  db().transaction(() => {
    for (const e of list) {
      const kind = String(e.kind ?? e.type ?? "") as Kind;
      if (!(SITE_KINDS as readonly string[]).includes(kind)) continue;
      const t = Date.parse(String(e.at ?? ""));
      const at = new Date(Number.isFinite(t) && Math.abs(Date.now() - t) < 86_400_000 ? t : Date.now()).toISOString();
      const page = cut(String(e.page ?? "").split(/[?#]/)[0], 200) || "/";
      const label = scrub(cut(e.label, kind === "js_error" ? 300 : 120));
      ins.run(productId, at, kind, page, label, cut(e.source, 60) || source, cut(e.session, 40) || session, e.device === "mobile" ? "mobile" : device);
      if (kind === "js_error") errs.push({ label, page });
      n++;
    }
  })();
  // Помилки сторінки → у «Що виправити» продукту (одна й та сама — раз на годину), Telegram — як для програм
  for (const e of errs.slice(0, 5)) {
    const hour = new Date().toISOString().slice(0, 13);
    const id = createHash("sha1").update(`${productId}|${e.label.replace(/\d+/g, "#")}|${hour}`).digest("hex").slice(0, 24);
    const summary = `Сайт: ${e.label} (${e.page})`.slice(0, 300);
    if (addProductEvent({ event_id: `site-${id}`, product_id: productId, event: "app.error", summary, data_json: JSON.stringify(e), occurred_at: new Date().toISOString() })) void siteAlert(productId, summary);
  }
  return { ok: true, n };
}

// Telegram Саші про помилку сайту — як для програм: однакова не частіше разу на годину
async function siteAlert(productId: number, summary: string): Promise<void> {
  try {
    if (!autoOn("product_alerts")) return;
    const fp = `app.alert.${productId}.${createHash("sha1").update(summary.replace(/\d+/g, "#").toLowerCase()).digest("hex").slice(0, 16)}`;
    const last = getSetting(fp);
    if (last && Date.now() - Date.parse(last) < 3600_000) return;
    setSetting(fp, new Date().toISOString());
    const { tg, tgOwner } = await import("./telegram");
    const owner = tgOwner();
    if (owner) await tg("sendMessage", { chat_id: owner, text: `⚠️ Помилка на сайті · ${getProduct(productId)?.name ?? productId}\n${summary}` });
  } catch (e) { logError("site-alert", e); }
}

// ---- Зведення
type Row = { kind: string; page: string; label: string; source: string; session: string; device: string };
export type SitePulse = {
  days: number; sessions: number; views: number; mobile: number;
  sources: { k: string; n: number }[]; pages: { k: string; n: number }[]; clicks: { k: string; n: number }[];
  forms: { start: number; submit: number; success: number; errors: { k: string; n: number }[] };
  scroll: { k: string; n: number }[]; jsErrors: { k: string; n: number }[]; contacts: number; last: string | null;
};
const top = (xs: string[], n = 6) => [...xs.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => ({ k, n: v }));
const uniq = (rows: Row[]) => new Set(rows.map((r) => r.session).filter(Boolean)).size;

export function sitePulse(productId: number, days = 7): SitePulse {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const rows = db().prepare("SELECT kind, page, label, source, session, device FROM site_events WHERE product_id = ? AND at >= ?").all(productId, since) as Row[];
  const last = (db().prepare("SELECT MAX(at) a FROM site_events WHERE product_id = ?").get(productId) as { a: string | null }).a;
  const views = rows.filter((r) => r.kind === "view");
  const sess = new Map<string, Row>();
  for (const r of views) if (r.session && !sess.has(r.session)) sess.set(r.session, r);
  const firsts = [...sess.values()];
  const by = (k: string) => rows.filter((r) => r.kind === k);
  const clicks = by("click");
  return {
    days, sessions: sess.size, views: views.length, mobile: firsts.filter((r) => r.device === "mobile").length,
    sources: top(firsts.map((r) => r.source || "direct")), pages: top(views.map((r) => r.page)), clicks: top(clicks.map((r) => r.label || "без назви"), 8),
    forms: { start: uniq(by("form_start")), submit: uniq(by("form_submit")), success: uniq(by("form_success")), errors: top(by("form_error").map((r) => r.label || "помилка"), 5) },
    scroll: top(by("scroll").map((r) => r.label), 4), jsErrors: top(by("js_error").map((r) => r.label), 5),
    contacts: clicks.filter((r) => /^(tel|phone|viber|whatsapp|telegram|mail|email|messenger)/i.test(r.label)).length, last,
  };
}

export function sitePulseText(productId: number, days = 7): string {
  const s = sitePulse(productId, days);
  if (!s.views && !s.last) return "";
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");
  return [
    `Пульс сайту за ${days} дн.: відвідувань ${s.sessions} (з телефону ${pct(s.mobile, s.sessions)}), переглядів сторінок ${s.views}`,
    s.sources.length && `Звідки: ${s.sources.map((x) => `${x.k} ${x.n}`).join(", ")}`,
    s.clicks.length && `Натискають: ${s.clicks.map((x) => `${x.k} ${x.n}`).join(", ")}`,
    `Форма: почали ${s.forms.start} → відправили ${s.forms.submit} → успішно ${s.forms.success}${s.forms.errors.length ? `; помилки: ${s.forms.errors.map((x) => `${x.k} ${x.n}`).join(", ")}` : ""}`,
    s.jsErrors.length && `Помилки сторінки: ${s.jsErrors.map((x) => `${x.k} ×${x.n}`).join("; ")}`,
  ].filter(Boolean).join("\n");
}

export const purgeSiteEvents = () => db().prepare("DELETE FROM site_events WHERE at < ?").run(new Date(Date.now() - 90 * 86_400_000).toISOString());

// ---- Промпт підключення для Claude Code сайту
export function sitePrompt(productId: number, host: string): string {
  const p = getProduct(productId);
  if (!p) return "";
  const url = `${host}/api/site/${siteKey(productId)}`;
  return `Це сайт «${p.name}» (${productCode(p.id)}). Підключи його до моєї системи Client Ops, щоб я бачив, що роблять люди на сайті. Нічого іншого на сайті не міняй і не ламай.

ЩО ЗРОБИТИ
1. Маленький скрипт без бібліотек (до ~3 КБ), підключений на ВСІХ сторінках, асинхронно, щоб не гальмував завантаження. Помилка в ньому ніколи не має ламати сайт (усе в try/catch).
2. Він збирає події в чергу і шле пачкою кожні 5 с і при закритті сторінки (pagehide/visibilitychange = hidden) через navigator.sendBeacon (запасний варіант — fetch з keepalive: true).
   Тіло — текст JSON (content-type text/plain):
   {"session":"<випадковий id, sessionStorage>","device":"mobile|desktop","source":"<джерело>","events":[{"kind":"…","page":"/шлях","label":"…","at":"ISO-час"}]}
   До 50 подій в одній пачці.
   КУДИ ШЛЕ: сайт на Cloudflare, секрети я тримаю там. Тому скрипт шле на СВІЙ домен — POST /api/pulse, а серверна функція Cloudflare (Pages Function або Worker — як уже влаштовано цей сайт) пересилає тіло як є на мою систему:
   POST ${host}/api/site/<SITE_PULSE_KEY>
   де SITE_PULSE_KEY — секрет у Cloudflare (я додам його сам, значення: ${siteKey(productId)}). У коді ключа бути не повинно — тільки env.SITE_PULSE_KEY. Функція: приймає тільки POST, тіло до 64 КБ, відповідає 204 одразу (пересилання — через ctx.waitUntil), помилки пересилання ковтає, назад нічого не віддає. Якщо секрету нема — мовчки нічого не шле.
3. Джерело (source) визначай при першому заході і тримай у sessionStorage: fbclid або utm_source=facebook/fb → "facebook", instagram → "instagram", gclid або utm_source=google → "google", інший utm_source → його значення, інакше referrer → "referral:<домен>", інакше "direct".
4. Події (kind):
   - view — кожен показ сторінки (і зміна маршруту, якщо сайт односторінковий/SPA);
   - click — натискання на важливе: кнопки заявки/CTA, посилання tel:, mailto:, viber:, wa.me / whatsapp, t.me, месенджери, соцмережі, ціни/пакети. label = короткий зрозумілий підпис: для контактів "tel", "viber", "whatsapp", "telegram", "email"; для кнопок — data-track="…", якщо є, інакше текст кнопки (до 40 символів). Додай data-track з нормальними назвами на головні кнопки (напр. data-track="cta-hero", "cta-price", "cta-footer");
   - form_start — перше введення в форму (раз на форму за сесію), label = назва форми (data-form або id);
   - form_submit — натиснули «відправити»;
   - form_success — заявка реально пішла (успішна відповідь сервера);
   - form_error — помилка валідації або відправки, label = яке поле / що за помилка (БЕЗ того, що людина ввела);
   - scroll — глибина гортання 25 / 50 / 75 / 100 (кожна раз за сторінку), label = "25" … "100";
   - js_error — window.onerror і unhandledrejection, label = текст помилки + файл:рядок (до 300 символів). Не частіше 5 на сторінку.
5. ПРИВАТНІСТЬ: ніколи не відправляй те, що людина вводить (імена, телефони, пошти, тексти). Тільки події і назви.
6. Пікселі (Meta вже підключений): на form_success шли fbq('track','Lead'), на кліки tel/месенджерів — fbq('track','Contact'), якщо їх ще нема. Не дублюй, якщо вже є.
7. Перевір: відкрий сайт, поклікай — у вкладці Network мають іти запити на /api/pulse зі статусом 204; у логах функції — відповідь моєї системи {"ok":true}. Перевір на телефоні (мобільна версія).
   Наприкінці нагадай мені: «Додай у Cloudflare секрет SITE_PULSE_KEY і передеплой».
8. Закоміть і запуш, як заведено в цьому репо.
${p.clarity_id ? `\n9. ${claritySteps(p.clarity_id)}\n` : ""}
Наприкінці видай оновлення СТРОГО в такому блоці (тільки факти, без ключів):

[CLIENT-OPS:ОНОВЛЕННЯ]
Продукт: ${p.name}
Коротко: підключено «Пульс сайту» (події в Client Ops)
Що зробили:
- [дата] …
Що змінилось у складі (стек, модулі, API, база):
- Скрипт пульсу: … (де лежить файл)
- Які кнопки отримали data-track: …
Де зупинились (стан прямо зараз):
- …
[/CLIENT-OPS]`;
}

// ---- Microsoft Clarity: теплові карти і записи сесій (ID проєкту — публічний)
export const clarityUrl = (id: string, view: "heatmaps" | "recordings" | "dashboard" = "heatmaps") => `https://clarity.microsoft.com/projects/view/${id}/${view}`;
const claritySteps = (id: string) => `ТЕПЛОВА КАРТА (Microsoft Clarity, ID проєкту ${id}):
- Додай офіційний тег Clarity у <head> на ВСІХ сторінках (асинхронно, не гальмує сайт):
  (function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${id}");
- Якщо вже є тег Clarity з іншим ID — заміни, не дублюй.
- Приватність: на всі форми і поля вводу додай атрибут data-clarity-mask="true" (імена, телефони, пошти не мають потрапити в записи).
- Якщо на сайті є пульс Client Ops (скрипт з джерелом source) — передай джерело в Clarity: clarity("set","source", source), щоб фільтрувати карти за рекламою.
- Якщо сайт односторінковий (SPA) — Clarity сам ловить зміни маршруту, нічого не треба.
- Перевір: у Network є запити на clarity.ms; у кабінеті Clarity через 1–2 год зʼявляться перші сесії.`;

export function clarityPrompt(productId: number): string {
  const p = getProduct(productId);
  if (!p) return "";
  if (!p.clarity_id) return "Спершу впиши ID проєкту Clarity у «Пульс сайту».";
  return `Це сайт «${p.name}» (${productCode(p.id)}). Постав на нього Microsoft Clarity. Нічого іншого на сайті не міняй і не ламай.

${claritySteps(p.clarity_id)}

Закоміть і запуш, як заведено в цьому репо. Наприкінці видай оновлення СТРОГО в такому блоці:

[CLIENT-OPS:ОНОВЛЕННЯ]
Продукт: ${p.name}
Коротко: підключено Microsoft Clarity (теплові карти і записи сесій)
Що зробили:
- [дата] …
Що змінилось у складі (стек, модулі, API, база):
- Microsoft Clarity, ID ${p.clarity_id}: … (де стоїть тег)
Де зупинились (стан прямо зараз):
- …
[/CLIENT-OPS]`;
}
