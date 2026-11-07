// Конкуренти: імпорт з Excel (колонки за назвами), перевірка Джері (сайт + новини), тижневий нагляд
import { autoOn } from "./agent/caps";
import { askWithWeb } from "./aiRadar";
import { asText } from "./llmJson";
import { logError } from "./log";
import { getClient } from "./repo/clients";
import { addNote, COMP_FIELDS, dueForCheck, findCompetitor, getCompetitor, listCompetitors, listNotes, markChecked, saveCompetitor, THREAT, type CompField } from "./repo/competitors";
import { getSetting, setSetting } from "./repo/settings";
import { readXlsx } from "./xlsx";

// Назва колонки в Excel → поле (за початком слова, без регістру)
const HEAD: [RegExp, CompField][] = [
  [/^компанія|^назва|^бренд/i, "name"], [/^рів|^тип|^категор/i, "level"], [/^сайт|^url|^посилан/i, "site"], [/^регіон|^місто|^гео/i, "region"],
  [/^масштаб|^розмір/i, "scale"], [/^що роб|^послуг/i, "what"], [/^для кого|^цільов|^аудитор/i, "for_whom"], [/^чому/i, "why"],
  [/^перева|^плюс/i, "pros"], [/^мінус|^недол/i, "cons"], [/^цифр|^ціни|^ціна/i, "numbers"], [/^загроз|^ризик/i, "threat"],
  [/^що з цим|^що робимо|^дії|^наш хід/i, "action"], [/^як перев|^джерел/i, "checked"],
];

export function importCompetitors(clientId: number, buf: Buffer): { added: number; updated: number; insights: number; levels: number } {
  const sheets = readXlsx(buf);
  let added = 0, updated = 0, insights = 0, levels = 0;
  for (const sh of sheets) {
    const hi = sh.rows.findIndex((r) => r.some((c) => /^(компанія|назва компанії|бренд)$/i.test(c.trim())));
    if (hi >= 0 && sh.rows[hi].some((c) => /^(рів|сайт|загроз)/i.test(c))) {
      const map = sh.rows[hi].map((h) => HEAD.find(([re]) => re.test(h.trim()))?.[1] ?? null);
      for (const r of sh.rows.slice(hi + 1)) {
        const data: Partial<Record<CompField, string>> = {};
        map.forEach((f, i) => { if (f && r[i]) data[f] = r[i]; });
        if (!data.name?.trim()) continue;
        const ex = findCompetitor(clientId, data.name);
        saveCompetitor(clientId, data, ex?.id);
        if (ex) updated++; else added++;
      }
      continue;
    }
    if (/висновк/i.test(sh.name)) {
      const pts = sh.rows.map((r) => r.filter(Boolean)).filter((r) => r.length && !/^що з цього/i.test(r[r.length - 1])).map((r) => `- ${r[r.length - 1]}`);
      if (pts.length) { setSetting(`comp.insights.${clientId}`, pts.join("\n")); insights = pts.length; }
    }
    if (/рівн/i.test(sh.name)) {
      const lv = sh.rows.filter((r) => /^\d+\.\s/.test(r[0] ?? "") && r[1]).map((r) => `- **${r[0]}** — ${r[1]}`);
      if (lv.length) { setSetting(`comp.levels.${clientId}`, lv.join("\n")); levels = lv.length; }
    }
  }
  return { added, updated, insights, levels };
}

// Короткий знімок для Джері
export function competitorsSnapshot(clientId: number): string {
  const all = listCompetitors(clientId);
  if (!all.length) return "";
  const top = all.filter((c) => c.threat === "high").slice(0, 8);
  return `Конкурентів у базі: ${all.length} (висока загроза ${all.filter((c) => c.threat === "high").length}, під наглядом ${all.filter((c) => c.watch).length}). Найнебезпечніші: ${top.map((c) => `${c.name}${c.action ? ` — ${c.action.slice(0, 120)}` : ""}`).join("; ")}`;
}

// Перевірка Джері: що нового на сайті / в новинах / рекламі конкурента з минулої перевірки
export async function checkCompetitor(id: number): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const c = getCompetitor(id);
  if (!c) return { ok: false, error: "Конкурента нема" };
  const client = getClient(c.client_id);
  const prev = listNotes(id, 6).map((n) => `${n.created_at.slice(0, 10)}: ${n.text.slice(0, 300)}`);
  const system = `Ти стежиш за конкурентом для клієнта «${client?.name ?? ""}»${client?.niche ? ` (${client.niche})` : ""}. Відкрий сайт конкурента (web_fetch) і пошукай свіже про нього (web_search: новини, соцмережі, реклама, ціни, нові послуги, кейси) за останні тижні.
Порівняй з тим, що вже знаємо і що було в минулих перевірках. Пиши ТІЛЬКИ нове або важливе: зміни послуг/цін/оферу, нові кейси й цифри, активна реклама, нові напрями, проблеми. Без води.
Відповідай ТІЛЬКИ JSON: {"changed": true|false, "summary": "2–5 пунктів «- » що нового (або «Суттєвих змін не видно»)", "important": true|false (чи варто Саші знати негайно), "url": "головне посилання або порожньо"}. Українською.`;
  const user = `КОНКУРЕНТ:\n${JSON.stringify(Object.fromEntries((Object.keys(COMP_FIELDS) as CompField[]).map((k) => [k, c[k]])))}\n\nМИНУЛІ ПЕРЕВІРКИ:\n${prev.join("\n") || "ще не було"}`;
  try {
    const out = await askWithWeb(system, user, 3000);
    const a = out.indexOf("{"), z = out.lastIndexOf("}");
    const j = a >= 0 && z > a ? (JSON.parse(out.slice(a, z + 1).replace(/,\s*([\]}])/g, "$1")) as Record<string, unknown>) : { summary: out };
    const text = asText(j.summary).trim() || "Суттєвих змін не видно";
    addNote(id, { kind: j.changed ? "change" : "check", text, url: asText(j.url), source: "jerry" });
    markChecked(id);
    if (j.important && j.changed) {
      const { tg, tgOwner } = await import("./telegram");
      const owner = tgOwner();
      if (owner) await tg("sendMessage", { chat_id: owner, text: `👀 Конкурент · ${client?.name ?? ""} · ${c.name}\n${text.slice(0, 900)}` }).catch(() => {});
    }
    return { ok: true, text };
  } catch (e) {
    logError("competitor-check", e);
    markChecked(id);
    return { ok: false, error: `Не вдалось: ${String((e as Error).message).slice(0, 160)}` };
  }
}

// Нагляд: щогодини 9–21 за Києвом — по одному конкуренту «під наглядом», якого не перевіряли 7+ днів
export async function competitorTick(): Promise<void> {
  if (!autoOn("competitor_watch")) return;
  const hour = Number(new Date().toLocaleString("en-US", { timeZone: "Europe/Kyiv", hour: "numeric", hour12: false }));
  if (hour < 9 || hour >= 21) return;
  const last = Date.parse(getSetting("comp.tick_at") ?? "");
  if (!Number.isNaN(last) && Date.now() - last < 55 * 60_000) return;
  setSetting("comp.tick_at", new Date().toISOString());
  const [c] = dueForCheck(1);
  if (c) void checkCompetitor(c.id).catch((e) => logError("competitor-check", e));
}
export const threatLabel = (t: string) => THREAT[t as keyof typeof THREAT]?.label ?? "—";
