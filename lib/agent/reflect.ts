// Самонавчання: після кожної розмови помічник перечитує, що було, і оновлює свою пам'ять.
// Працює у фоні (відповідь Саші не чекає), окремим коротким запитом.
import Anthropic from "@anthropic-ai/sdk";
import { ai } from "../ai";
import { logError } from "../log";
import { autoOn } from "./caps";
import { getApiKey } from "../secrets";
import { agentConfig, agentMemory, MEMORY_MAX, setAgentMemory } from "./config";

export const MEMORY_TEMPLATE = `## Про Сашу
## Як працювати (правила і вподобання)
## Помилки й уроки
## Цілі і напрям
## Поточний фокус`;

const PROMPT = `Ти — внутрішній «мозок» помічника Саші в системі client-ops. Твоя робота: після кожної розмови оновити довгу пам'ять помічника.

Отримаєш поточну пам'ять і останній обмін (що сказав Саша, що відповів і зробив помічник).
Онови пам'ять так, щоб помічник з кожним разом працював краще:
- «Про Сашу»: факти про нього, бізнес, ціни, клієнтів загалом, стиль.
- «Як працювати»: правила і вподобання (як писати, що робити без питань, чого не робити).
- «Помилки й уроки»: якщо Саша виправив помічника, був незадоволений або помічник помилився — запиши урок одним рядком: що було не так → як правильно.
- «Цілі і напрям»: куди рухається Саша і система.
- «Поточний фокус»: що зараз у роботі (тимчасове; прибирай, коли неактуальне).
Правила: коротко, пунктами «- ». Без дублів. Неактуальне і суперечливе — прибери або виправ. Конкретні дані клієнтів (суми, задачі) НЕ копіюй — вони в базі; пам'ять тільки про підхід, правила і уроки. Ніяких паролів і ключів. Максимум ${MEMORY_MAX - 500} символів.

Якщо в обміні нема нічого, що варто запам'ятати чи виправити, — відповідай рівно: NO_CHANGE
Інакше — поверни ТІЛЬКИ повний новий текст пам'яті з цими розділами:
${MEMORY_TEMPLATE}`;

const g = globalThis as unknown as { __reflecting?: boolean };

export async function reflect(exchange: { user: string; reply: string; actions: string[] }): Promise<void> {
  const key = getApiKey();
  if (!key || g.__reflecting || !autoOn("reflect")) return;
  // Короткі «ок», «дякую» — нема чого вчити
  if (exchange.user.trim().length < 12 && !exchange.actions.length) return;
  g.__reflecting = true;
  try {
    const cfg = agentConfig();
    const res = await ai("памʼять", { apiKey: key }).messages.create({
      model: cfg.model,
      max_tokens: 4000,
      system: PROMPT,
      output_config: { effort: "low" },
      messages: [{
        role: "user",
        content: `ПОТОЧНА ПАМ'ЯТЬ:\n${agentMemory() || "(порожньо)"}\n\nОСТАННІЙ ОБМІН:\nСаша: ${exchange.user.slice(0, 6000)}\n\nПомічник: ${exchange.reply.slice(0, 4000)}${exchange.actions.length ? `\n\nДії помічника: ${exchange.actions.join("; ")}` : ""}`,
      }],
    });
    if (res.stop_reason === "refusal") return;
    const text = res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("").trim();
    if (!text || text.startsWith("NO_CHANGE") || !text.includes("##")) return;
    const { compressMemory, memoryNearlyFull } = await import("./memoryCompress");
    if (text.length > MEMORY_MAX) { await compressMemory(text); return; }
    setAgentMemory(text);
    if (memoryNearlyFull(text.length)) void compressMemory();
  } catch (e) {
    logError("reflect", e);
  } finally {
    g.__reflecting = false;
  }
}

// ── Памʼять по клієнту: після розмови про клієнта переписуємо його «стан справ», щоб наступного разу
// Джері не починав з нуля (зустріч була, про гроші домовились, бота запустили…)
export const CLIENT_MEMORY_TEMPLATE = `## Де ми зараз
## Домовленості (гроші, обсяг, терміни)
## Що вже зроблено
## Що в роботі і далі
## Важливо памʼятати`;

const CLIENT_PROMPT = `Ти ведеш «памʼять по клієнту» для помічника Саші. Отримаєш поточну памʼять по клієнту, його дані з бази і останній обмін Саші з помічником.
Онови памʼять, якщо в обміні є нові ФАКТИ про цього клієнта: що сталось (зустріч, дзвінок, запуск), про що домовились (гроші, обсяг робіт, терміни), що зроблено, що далі, рішення, проблеми, люди і ролі з боку клієнта.
Правила:
- Тільки факти, які прямо є в обміні чи даних. Не вигадуй, не роби висновків «можливо».
- «Де ми зараз» — 1–3 рядки: етап співпраці і головне зараз.
- Зроблене не видаляй (стисни старе в один рядок, якщо довго). Неактуальне «далі» перенось у «зроблено» або прибирай.
- Дати пиши, якщо відомі. Пунктами «- ». Максимум 3500 символів. Ніяких паролів і ключів.
Якщо нових фактів про ЦЬОГО клієнта нема — відповідай рівно: NO_CHANGE
Інакше поверни ТІЛЬКИ повний новий текст памʼяті з розділами:
${CLIENT_MEMORY_TEMPLATE}`;

const busy = new Set<number>();
export async function reflectClient(clientId: number, exchange: { user: string; reply: string; actions: string[] }): Promise<void> {
  const key = getApiKey();
  if (!key || busy.has(clientId) || !autoOn("client_memory")) return;
  if (exchange.user.trim().length < 12 && !exchange.actions.length) return;
  busy.add(clientId);
  try {
    const { getClientMemory, setClientMemory } = await import("../repo/clientMemory");
    const { getClientRow } = await import("../repo/clients");
    const c = getClientRow(clientId);
    if (!c) return;
    const res = await ai("памʼять", { apiKey: key }).messages.create({
      model: agentConfig().model,
      max_tokens: 3000,
      system: CLIENT_PROMPT,
      output_config: { effort: "low" },
      messages: [{
        role: "user",
        content: `КЛІЄНТ: ${c.name} (статус ${c.status}${c.next_step ? `, наступний крок у картці: ${c.next_step}` : ""})\n\nПОТОЧНА ПАМʼЯТЬ:\n${getClientMemory(clientId)?.text || "(порожньо)"}\n\nОСТАННІЙ ОБМІН:\nСаша: ${exchange.user.slice(0, 6000)}\n\nПомічник: ${exchange.reply.slice(0, 4000)}${exchange.actions.length ? `\n\nДії помічника: ${exchange.actions.join("; ")}` : ""}`,
      }],
    });
    if (res.stop_reason === "refusal") return;
    const text = res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("").trim();
    if (!text || text.startsWith("NO_CHANGE") || !text.includes("##")) return;
    setClientMemory(clientId, text);
  } catch (e) {
    logError("reflect-client", e);
  } finally {
    busy.delete(clientId);
  }
}
