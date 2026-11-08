// Клієнт Claude з обліком витрат: обгортаємо fetch і читаємо usage з копії відповіді (і JSON, і потік SSE).
// Кожен виклик → таблиця api_usage (функція, модель, токени, $). Відповідь не затримуємо — розбір у фоні.
import Anthropic, { type ClientOptions } from "@anthropic-ai/sdk";
import { db } from "./db";

// $ за 1 млн токенів (прайс Anthropic, жовтень 2026). Запис у кеш ≈ ×1.25 від input.
const PRICE: Record<string, { in: number; out: number; read: number }> = {
  "claude-fable-5-1": { in: 10, out: 50, read: 0.25 },
  "claude-fable-5": { in: 10, out: 50, read: 1 },
  "claude-opus-5-5": { in: 4, out: 20, read: 0.2 },
  "claude-opus-5": { in: 5, out: 25, read: 0.5 },
  "claude-sonnet-5-5": { in: 2, out: 10, read: 0.2 },
  "claude-sonnet-5": { in: 2, out: 10, read: 0.2 },
  "claude-haiku-5-5": { in: 0.1, out: 0.5, read: 0.01 },
};
const WEB_SEARCH = 10 / 1000; // $ за пошук
const priceOf = (model: string) => PRICE[model] ?? PRICE[Object.keys(PRICE).find((k) => model.startsWith(k)) ?? ""] ?? PRICE["claude-opus-5-5"];

type U = { input_tokens?: number; output_tokens?: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number; server_tool_use?: { web_search_requests?: number } };
export function costOf(model: string, u: U): number {
  const p = priceOf(model);
  return ((u.input_tokens ?? 0) * p.in + (u.cache_creation_input_tokens ?? 0) * p.in * 1.25 + (u.cache_read_input_tokens ?? 0) * p.read + (u.output_tokens ?? 0) * p.out) / 1e6
    + (u.server_tool_use?.web_search_requests ?? 0) * WEB_SEARCH;
}

function record(feature: string, model: string, u: U) {
  try {
    db().prepare(`INSERT INTO api_usage (feature, model, input_tokens, output_tokens, cache_write, cache_read, web_searches, cost_usd) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(feature, model, u.input_tokens ?? 0, u.output_tokens ?? 0, u.cache_creation_input_tokens ?? 0, u.cache_read_input_tokens ?? 0, u.server_tool_use?.web_search_requests ?? 0, costOf(model, u));
  } catch { /* облік не має ламати роботу */ }
}

// Потік: usage приходить у message_start (вхід) і message_delta (вихід, наростаючим підсумком)
function fromSse(text: string): { model: string; u: U } | null {
  let model = "", u: U = {};
  for (const line of text.split("\n")) {
    if (!line.startsWith("data:")) continue;
    try {
      const e = JSON.parse(line.slice(5)) as { type: string; message?: { model: string; usage: U }; usage?: U };
      if (e.type === "message_start" && e.message) { model = e.message.model; u = { ...e.message.usage }; }
      if (e.type === "message_delta" && e.usage) u = { ...u, ...Object.fromEntries(Object.entries(e.usage).filter(([, v]) => v != null)) };
    } catch { /* неповний рядок */ }
  }
  return model ? { model, u } : null;
}

const loggingFetch = (feature: string): typeof fetch => async (input, init) => {
  const res = await fetch(input, init);
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (res.ok && /\/v1\/messages(\?|$)/.test(url)) {
    const copy = res.clone();
    void copy.text().then((t) => {
      if ((res.headers.get("content-type") ?? "").includes("event-stream")) { const r = fromSse(t); if (r) record(feature, r.model, r.u); }
      else { const j = JSON.parse(t) as { model?: string; usage?: U }; if (j.usage) record(feature, j.model ?? "", j.usage); }
    }).catch(() => {});
  }
  return res;
};

// Замість new Anthropic(...): ai("радар", { apiKey, timeout })
export const ai = (feature: string, opts: ClientOptions = {}) => new Anthropic({ ...opts, fetch: loggingFetch(feature) });

// ---- Для екрана «Витрати» і тривоги ліміту
const monthStart = () => new Date().toLocaleString("sv-SE", { timeZone: "Europe/Kyiv" }).slice(0, 7) + "-01";
export function usageSummary() {
  const q = <T>(sql: string, ...a: unknown[]) => db().prepare(sql).all(...a) as T[];
  const one = (sql: string, ...a: unknown[]) => (db().prepare(sql).get(...a) as { v: number | null }).v ?? 0;
  const ms = monthStart();
  return {
    today: one("SELECT SUM(cost_usd) v FROM api_usage WHERE date(at, '+2 hours') = date('now', '+2 hours')"),
    month: one("SELECT SUM(cost_usd) v FROM api_usage WHERE date(at, '+2 hours') >= ?", ms),
    calls: one("SELECT COUNT(*) v FROM api_usage WHERE date(at, '+2 hours') >= ?", ms),
    byFeature: q<{ feature: string; n: number; cost: number; tin: number; tout: number }>("SELECT feature, COUNT(*) n, SUM(cost_usd) cost, SUM(input_tokens + cache_read + cache_write) tin, SUM(output_tokens) tout FROM api_usage WHERE date(at, '+2 hours') >= ? GROUP BY feature ORDER BY cost DESC", ms),
    byModel: q<{ model: string; n: number; cost: number }>("SELECT model, COUNT(*) n, SUM(cost_usd) cost FROM api_usage WHERE date(at, '+2 hours') >= ? GROUP BY model ORDER BY cost DESC", ms),
    byDay: q<{ day: string; cost: number }>("SELECT date(at, '+2 hours') day, SUM(cost_usd) cost FROM api_usage WHERE at >= datetime('now', '-30 days') GROUP BY day ORDER BY day"),
  };
}
