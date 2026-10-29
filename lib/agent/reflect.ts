// Самонавчання: після кожної розмови помічник перечитує, що було, і оновлює свою пам'ять.
// Працює у фоні (відповідь Саші не чекає), окремим коротким запитом.
import Anthropic from "@anthropic-ai/sdk";
import { logError } from "../log";
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
  if (!key || g.__reflecting) return;
  // Короткі «ок», «дякую» — нема чого вчити
  if (exchange.user.trim().length < 12 && !exchange.actions.length) return;
  g.__reflecting = true;
  try {
    const cfg = agentConfig();
    const res = await new Anthropic({ apiKey: key }).messages.create({
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
    setAgentMemory(text);
  } catch (e) {
    logError("reflect", e);
  } finally {
    g.__reflecting = false;
  }
}
