// Промпт «витяжка з іншого чату»: вставляєш у будь-який чат (Claude, ChatGPT, Claude Code) наприкінці розмови —
// він видає блок з міткою [CLIENT-OPS:ВИТЯЖКА]; цей блок вставляєш Джері, і він розкладає все по місцях у системі.
export const EXTRACT_MARK = "[CLIENT-OPS:ВИТЯЖКА]";

export function extractPrompt(scope: string): string {
  return `Склади ВИТЯЖКУ з нашої розмови вище для моєї системи керування Client Ops — мій помічник Джері запише її в базу.
Тема: ${scope || "визнач сам: клієнт, стартап/продукт чи загальне"}.

Правила:
- Тільки факти з цієї розмови. Нічого не вигадуй і не додавай від себе.
- Коротко, пунктами, конкретно: назви, цифри, дати, хто що робить.
- Ніяких паролів, токенів, ключів API — замість них пиши «[ключ у .env]».
- Порожні розділи пропусти.
- Відповідь — ТІЛЬКИ блок нижче, без вступу і пояснень.

${EXTRACT_MARK}
Про що: клієнт «…» / стартап «…» / загальне
Дата: …
Коротко: 2–3 речення — що обговорили і до чого дійшли
Рішення:
- що вирішили і чому
Домовленості і факти:
- гроші, терміни, обсяг робіт, хто за що відповідає
Що зроблено:
- …
Технічне (API, інтеграції, налаштування, важливі параметри):
- …
Що ламалось → як виправили:
- проблема → причина → рішення
Задачі / наступні кроки:
- що зробити — хто — до коли
Відкриті питання:
- …
Ідеї на потім:
- …
[/CLIENT-OPS]`;
}

// Тема з поточної сторінки системи: клієнт або стартап — щоб витяжка одразу знала, куди лягти
export function scopeFromPage(): string {
  if (typeof document === "undefined") return "";
  const path = location.pathname;
  const h1 = document.querySelector("main h1, .su-head h1")?.textContent?.trim() || "";
  const card = document.querySelector(".client-name, .hub-head h1, main h1")?.textContent?.trim() || h1;
  if (/^\/clients\/\d+/.test(path)) return `клієнт «${card}» (client_id ${path.split("/")[2]})`;
  if (/^\/startups\/\d+/.test(path)) return `стартап / продукт «${h1}» (startup_id ${path.split("/")[2]})`;
  if (/^\/lab\/\d+/.test(path)) return `лабораторія «${h1}» (lab_id ${path.split("/")[2]})`;
  return "";
}

// Скопіювати текст, який ще треба завантажити. Safari (iPhone) дозволяє копіювати тільки «в момент натискання»,
// тому віддаємо буферу обіцянку тексту через ClipboardItem; де так не можна — звичайний writeText після завантаження.
export async function copyLater(load: () => Promise<string>): Promise<boolean> {
  try {
    if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
      const blob = load().then((t) => new Blob([t], { type: "text/plain" }));
      await navigator.clipboard.write([new ClipboardItem({ "text/plain": blob })]);
      return true;
    }
  } catch { /* спробуємо інакше */ }
  try { await navigator.clipboard.writeText(await load()); return true; } catch { return false; }
}

export async function contextText(kind: "client" | "startup", id: number, fallback: string): Promise<string> {
  try {
    const r = await fetch(`/api/context/${kind}/${id}`, { cache: "no-store" });
    if (r.ok) return ((await r.json()) as { text: string }).text;
  } catch { /* */ }
  return fallback;
}
