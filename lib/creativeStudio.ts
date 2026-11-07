// Студія креативів: «Хто ми» (контекст для нового чату), коди CR-N → автопривʼязка оголошень Meta,
// цифри за весь час і автовердикт, витяжка [CLIENT-OPS:КРЕАТИВ] назад у картку.
import { money } from "./config";
import { cplOf } from "./metaInsights";
import { adsetMoreText } from "./metaExtra";
import { getClient } from "./repo/clients";
import { adIdsOf, codeOf, getPrompt, listPrompts, updatePrompt, type CreativePrompt } from "./repo/creatives";
import { adTotalsForClient, adsForClient, adsetsForClient, getAnalysis, type MetaAd } from "./repo/meta";
import { getSetting } from "./repo/settings";
import { getStrategy } from "./repo/strategy";
import { getBrand } from "./repo/brand";
import { brandMd } from "./brand";
import { stylesFor } from "./repo/creativeCenter";

export const CREATIVE_MARK = "[CLIENT-OPS:КРЕАТИВ]";
// Тексти бренду — з брендбуку (розділ «Бренд»)
export const rulesOf = (clientId: number) => getBrand(clientId).rules;
export const brandOf = (clientId: number) => brandMd(clientId, { files: false });
// Що рекламуємо кінцевому покупцю (не наша послуга клієнту): продукт, оффер, ціни, переваги, адреса
export const adOfferOf = (clientId: number) => getBrand(clientId).offer;

export type Verdict = "win" | "mid" | "lose" | "few" | "";
export const VERDICT: Record<Exclude<Verdict, "">, { label: string; tone: string }> = {
  win: { label: "виграв", tone: "ok" }, mid: { label: "середньо", tone: "accent" }, lose: { label: "програв", tone: "bad" }, few: { label: "мало даних", tone: "" },
};
export type CreativeNums = { ads: MetaAd[]; spend: number; leads: number; cpl: number | null; ctr: number | null; auto: Verdict; verdict: Verdict };

// Оголошення клієнта + цифри за весь час (якщо є), інакше за 30 днів
export function adBook(clientId: number) {
  const ads = adsForClient(clientId);
  const tot = new Map(adTotalsForClient(clientId).map((t) => [t.ad_id, t]));
  const life = (a: MetaAd) => { const t = tot.get(a.ad_id); return t ? { spend: t.spend, leads: t.leads } : { spend: a.spend_30d, leads: a.leads_30d }; };
  const all = ads.map(life).reduce((s, x) => ({ spend: s.spend + x.spend, leads: s.leads + x.leads }), { spend: 0, leads: 0 });
  return { ads, life, avgCpl: cplOf(all) };
}
type Book = ReturnType<typeof adBook>;

export function verdictOf(spend: number, leads: number, avg: number | null, hasAds: boolean): Verdict {
  if (!hasAds) return "";
  if (avg == null) return leads >= 5 ? "mid" : "few";
  if (leads === 0) return spend >= 2 * avg ? "lose" : "few";
  if (leads < 5 && spend < 3 * avg) return "few";
  const cpl = spend / leads;
  return cpl <= avg * 0.8 ? "win" : cpl >= avg * 1.3 ? "lose" : "mid";
}

export function creativeNums(p: CreativePrompt, b: Book): CreativeNums {
  const ids = adIdsOf(p);
  const mine = b.ads.filter((a) => ids.includes(a.ad_id));
  const t = mine.reduce((s, a) => { const l = b.life(a); return { spend: s.spend + l.spend, leads: s.leads + l.leads, clicks: s.clicks + a.clicks_30d, imp: s.imp + a.impressions_30d }; }, { spend: 0, leads: 0, clicks: 0, imp: 0 });
  const auto = verdictOf(t.spend, t.leads, b.avgCpl, mine.length > 0);
  return { ads: mine, spend: t.spend, leads: t.leads, cpl: cplOf(t), ctr: t.imp ? (t.clicks / t.imp) * 100 : null, auto, verdict: (p.verdict as Verdict) || auto };
}

// Код у назві оголошення («CR-12 · тераса») → оголошення саме привʼязується до креативу, креатив іде «У рекламу»
export function syncCodes(clientId: number): number {
  const prompts = new Map(listPrompts(clientId, 500).map((p) => [p.id, p]));
  let n = 0;
  for (const a of adsForClient(clientId)) {
    for (const m of a.name.matchAll(/\bCR[-\s#]?(\d{1,7})\b/gi)) {
      const p = prompts.get(Number(m[1]));
      if (!p || adIdsOf(p).includes(a.ad_id)) continue;
      const ids = [...adIdsOf(p), a.ad_id].join(",");
      const status = p.status === "idea" || p.status === "ready" ? "live" : p.status;
      updatePrompt(p.id, { ad_ids: ids, status });
      prompts.set(p.id, { ...p, ad_ids: ids, status });
      n++;
    }
  }
  return n;
}

const cut = (s: string, n: number) => { const t = s.replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1) + "…" : t; };

// «Хто ми» — перше повідомлення в новий чат Claude: усе, що треба знати про клієнта для креативів. Без ШІ, з бази.
export function creativeBrief(clientId: number): string {
  const c = getClient(clientId);
  if (!c) return "";
  syncCodes(clientId);
  const b = adBook(clientId);
  const st = getStrategy(clientId);
  const an = getAnalysis(clientId)?.data;
  const rated = b.ads.map((a) => ({ a, ...b.life(a) })).filter((x) => x.spend > 0);
  const best = rated.filter((x) => x.leads > 0 && (b.avgCpl == null || x.spend / x.leads <= b.avgCpl * 1.1)).sort((x, y) => x.spend / x.leads - y.spend / y.leads).slice(0, 5);
  const worst = rated.filter((x) => b.avgCpl != null && x.spend >= b.avgCpl * 1.5 && (x.leads === 0 || x.spend / x.leads >= b.avgCpl * 1.4)).sort((x, y) => y.spend - x.spend).slice(0, 4);
  const adLine = (x: (typeof rated)[number]) => `- «${cut(x.a.name, 60)}» (${x.a.kind || "оголошення"}): ${x.leads} лідів, ціна ліда ${x.leads ? money(x.spend / x.leads) : "—"}, витрачено ${money(x.spend)}${x.a.body ? `\n  Текст: «${cut(x.a.body, 220)}»` : ""}`;
  const mine = listPrompts(clientId, 30).map((p) => ({ p, n: creativeNums(p, b) })).filter((x) => x.n.verdict && x.n.verdict !== "few");
  const audience = adsetsForClient(clientId).filter((s) => s.spend_30d > 0).slice(0, 4).map((s) => { const t = adsetMoreText(s); return `- ${cut(s.name, 60)}${t ? ` — ${cut(t, 200)}` : ""}`; });
  const sec = (h: string, body: string | string[]) => { const t = Array.isArray(body) ? body.filter(Boolean).join("\n") : body.trim(); return t ? `## ${h}\n${t}\n` : ""; };
  return [
    `# Контекст: ${c.name} — реклама в Meta (Facebook / Instagram)`,
    `Ти — мій креативний партнер для реклами «${c.name}». Цей чат — тільки для креативів цього клієнта. Прочитай контекст і коротко підтверди в 3 рядках: хто клієнт, для кого реклама, головна думка, яка вже продає. Потім чекай завдання з кодом CR-N.\n`,
    sec("Клієнт", [c.niche && `Ніша: ${c.niche}`, c.client_vision && `Ціль клієнта: ${c.client_vision}`].filter(Boolean) as string[]),
    adOfferOf(clientId) ? "" : sec("Що рекламуємо", "Не заповнено — питай мене, не вигадуй."),
    sec("Фокус зараз", [st.focus, st.goal && `Куди йдемо: ${st.goal}`].filter(Boolean)),
    brandOf(clientId) ? `# Брендбук\n${brandOf(clientId)}\n` : sec("Бренд", "Не задано — стриманий сучасний стиль, місця під [логотип] і [фото обʼєкта]."),
    sec("Аудиторія (з реклами)", audience),
    sec(`Що вже дає найдешевші ліди${b.avgCpl != null ? ` (середня ціна ліда ${money(b.avgCpl)})` : ""}`, best.map(adLine)),
    sec("Що не спрацювало — не повторювати", worst.map(adLine)),
    sec("Патерни з розбору реклами", (an?.patterns ?? []).slice(0, 6).map((x: string) => `- ${x}`)),
    sec("Наші попередні креативи", mine.slice(0, 10).map(({ p, n }) => `- ${codeOf(p)} «${p.title}» (${p.format}) — ${VERDICT[n.verdict as Exclude<Verdict, "">].label}${n.leads ? `, ${n.leads} лідів по ${money(n.cpl)}` : ""}${p.angle ? `. Кут: ${p.angle}` : ""}`)),
    sec("Як працюємо", [
      "- Телефон перш за все: великий текст, сильний контраст, мінімум слів, головне читається за 1 секунду.",
      "- Один креатив = одна думка. Перша секунда / заголовок вирішує все.",
      "- Зображення роби як HTML/CSS рівно потрібного розміру (щоб я зберіг PNG); моушен — HTML/CSS/SVG-анімація 6–10 с; відео — покадровий сценарій з текстом на екрані.",
      "- Не вигадуй ціни, знижки, адреси, гарантії — став [уточнити].",
      "- Наприкінці кожного креативу видавай витяжку за шаблоном із завдання (блок [CLIENT-OPS:КРЕАТИВ]).",
      getSetting("creative.tools") ? `- Чим я роблю креативи: ${getSetting("creative.tools")}.` : "",
    ]),
    ...stylesFor().map((x) => sec(`Мій стиль: ${x.title}`, x.body)),
  ].filter(Boolean).join("\n");
}

export const extractFooter = (p: { id: number }) => `

---
Код креативу: ${codeOf(p)} — впиши його в назву оголошення в Meta (напр. «${codeOf(p)} · тераса»), тоді цифри підтягнуться самі.
Коли закінчимо, видай витяжку рівно в такому вигляді:
${CREATIVE_MARK}
Код: ${codeOf(p)}
Що зробили: …
Варіанти: А — …; Б — …
Тексти оголошення: primary text / headline
Файли: посилання або назви файлів
Що вийшло добре / що змінити наступного разу: …
[/CLIENT-OPS]`;

// Витяжка з чату → картка креативу (без ШІ: код + поля за підписами)
export function importCreative(text: string, clientId?: number): { ok: true; id: number; clientId: number; title: string } | { ok: false; error: string } {
  const code = text.match(/Код:\s*CR[-\s#]?(\d{1,7})/i) ?? text.match(/\bCR-(\d{1,7})\b/i);
  if (!code) return { ok: false, error: "У витяжці нема коду CR-N — допиши рядок «Код: CR-…»" };
  const p = getPrompt(Number(code[1]));
  if (!p) return { ok: false, error: `Креативу CR-${code[1]} нема` };
  if (clientId && p.client_id !== clientId) return { ok: false, error: `CR-${p.id} — креатив іншого клієнта` };
  const a = text.indexOf(CREATIVE_MARK), z = text.indexOf("[/CLIENT-OPS]");
  const body = text.slice(a >= 0 ? a + CREATIVE_MARK.length : 0, z > a ? z : undefined).trim();
  const files = body.match(/^Файли:\s*(.+)$/im)?.[1] ?? "";
  const url = (files.match(/https?:\/\/\S+/) ?? body.match(/https?:\/\/(?:drive|docs)\.google\.com\/\S+/))?.[0]?.replace(/[)\].,;]+$/, "") ?? "";
  updatePrompt(p.id, { result: body.slice(0, 20000), ...(url ? { file_url: url } : {}), ...(p.status === "idea" ? { status: "ready" } : {}) });
  return { ok: true, id: p.id, clientId: p.client_id, title: p.title };
}
