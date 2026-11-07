// Брендбук: текстом для Джері/креативів, промпт для дизайн-системи в Claude, витяжка [CLIENT-OPS:БРЕНД] назад
import { askJson, asText, llmErrorText } from "./llmJson";
import { logError } from "./log";
import { getClient } from "./repo/clients";
import { addColor, addFont, ASSET_KINDS, BRAND_FIELDS, COLOR_ROLES, FONT_ROLES, getBrand, listAssets, listColors, listFonts, saveBrand, type BrandField } from "./repo/brand";

export const BRAND_MARK = "[CLIENT-OPS:БРЕНД]";

export function brandMd(clientId: number, o: { files?: boolean } = {}): string {
  const b = getBrand(clientId), colors = listColors(clientId), fonts = listFonts(clientId), assets = listAssets(clientId);
  const out: string[] = [];
  for (const k of Object.keys(BRAND_FIELDS) as BrandField[]) if (b[k].trim()) out.push(`## ${BRAND_FIELDS[k].label}\n${b[k].trim()}`);
  if (colors.length) out.push(`## Кольори\n${colors.map((c) => `- ${c.hex}${c.name ? ` — ${c.name}` : ""}${c.role ? ` (${COLOR_ROLES[c.role as keyof typeof COLOR_ROLES] ?? c.role})` : ""}`).join("\n")}`);
  if (fonts.length) out.push(`## Шрифти\n${fonts.map((f) => `- ${f.name}${f.role ? ` — ${FONT_ROLES[f.role as keyof typeof FONT_ROLES] ?? f.role}` : ""}${f.url ? ` (${f.url})` : ""}${f.note ? `. ${f.note}` : ""}`).join("\n")}`);
  if (o.files !== false && assets.length) out.push(`## Файли бренду\n${assets.map((a) => `- ${ASSET_KINDS[a.kind as keyof typeof ASSET_KINDS] ?? a.kind}: ${a.title}${a.url ? ` — ${a.url}` : a.file_id ? " (файл у системі)" : ""}${a.note ? `. ${a.note}` : ""}`).join("\n")}`);
  return out.join("\n\n");
}

export function brandPrompt(clientId: number): string {
  const c = getClient(clientId);
  const md = brandMd(clientId);
  return `Ти — бренд-дизайнер. Клієнт: «${c?.name ?? ""}»${c?.niche ? ` (${c.niche})` : ""}. Допоможи зробити або довести до ладу його дизайн-систему / брендбук: позиціонування, тон, кольори (HEX з ролями: основний, акцент, фон, текст), шрифти (заголовки/текст, бажано Google Fonts), правила використання логотипа, можна/не можна, візуальний стиль для реклами і сайту.

ВАЖЛИВО: якщо в цьому чаті або проєкті (файли проєкту, попередні розмови, макети) вже є напрацювання по бренду — НЕ починай з нуля: збери звідти все, що вже вирішено (кольори з HEX, шрифти, подача, тон, позиціонування), покажи мені коротко «що взяв», і постав 3–5 питань тільки про те, чого бракує або що суперечить одне одному.
${md ? `\nЩо вже записано в моїй системі (звір із напрацюваннями в проєкті; якщо розходиться — спитай, що правильно):\n${md}\n` : "\nУ моїй системі ще нічого не записано. Якщо напрацювань у проєкті теж нема — спершу постав мені 5–7 питань про клієнта.\n"}
Пиши українською, коротко і конкретно. Логотипи і файли шрифтів у витяжку не влізуть — просто перелічи, які файли є (я завантажу їх сам). Наприкінці, коли домовимось, видай витяжку рівно в такому вигляді (тільки заповнене):
${BRAND_MARK}
Позиціонування: …
Для кого: …
Що рекламуємо: …
Головне обіцяння: …
Тон спілкування: …
Можна / не можна: …
Візуальний стиль: …
Кольори: #XXXXXX — назва (роль); #XXXXXX — назва (роль)
Шрифти: Назва — заголовки (посилання); Назва — текст
[/CLIENT-OPS]`;
}

type Ops = Partial<Record<BrandField, unknown>> & { colors?: unknown; fonts?: unknown };

// Витяжка з Claude (або довільний опис бренду) → поля, кольори, шрифти. Порожні поля не стирають старі.
export async function importBrand(clientId: number, text: string): Promise<{ ok: true; summary: string[] } | { ok: false; error: string }> {
  if (text.trim().length < 15) return { ok: false, error: "Порожньо" };
  const cur = getBrand(clientId);
  const system = `Ти розкладаєш опис бренду (витяжка ${BRAND_MARK} або вільний текст) по брендбуку. Поточні поля: ${JSON.stringify(Object.fromEntries((Object.keys(BRAND_FIELDS) as BrandField[]).map((k) => [k, cur[k]])))}.
Поверни ТІЛЬКИ JSON: {${(Object.keys(BRAND_FIELDS) as BrandField[]).map((k) => `"${k}": "текст або null (${BRAND_FIELDS[k].label})"`).join(", ")}, "colors": [{"hex": "#RRGGBB", "name": "...", "role": "primary|secondary|accent|background|text"}], "fonts": [{"name": "...", "role": "headings|body|accent", "url": "..."}]}.
Правила: тільки факти з тексту; поле, про яке в тексті нічого, — null (не стирай); якщо в тексті нове для поля — повний оновлений текст поля (старе + нове без дублів).`;
  try {
    const ops = await askJson<Ops>(system, text.slice(0, 40000));
    const sum: string[] = [];
    const patch: Partial<Record<BrandField, string>> = {};
    for (const k of Object.keys(BRAND_FIELDS) as BrandField[]) { const v = ops[k]; if (v != null && asText(v).trim()) patch[k] = asText(v); }
    if (Object.keys(patch).length) { saveBrand(clientId, patch); sum.push(`Поля: ${Object.keys(patch).map((k) => BRAND_FIELDS[k as BrandField].label).join(", ")}`); }
    const arr = (v: unknown) => (Array.isArray(v) ? v : []) as Record<string, unknown>[];
    let nc = 0, nf = 0;
    for (const c of arr(ops.colors)) if (c && addColor(clientId, { hex: asText(c.hex), name: asText(c.name), role: asText(c.role) })) nc++;
    for (const f of arr(ops.fonts)) if (f && addFont(clientId, { name: asText(f.name), role: asText(f.role), url: asText(f.url) })) nf++;
    if (nc) sum.push(`Кольори +${nc}`);
    if (nf) sum.push(`Шрифти +${nf}`);
    return { ok: true, summary: sum.length ? sum : ["Нового не знайшов"] };
  } catch (e) {
    logError("brand-import", e);
    return { ok: false, error: llmErrorText(e) };
  }
}
