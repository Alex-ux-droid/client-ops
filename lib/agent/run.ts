// Помічник: один хід розмови = цикл запитів до Claude, поки він викликає інструменти.
// Історія між ходами — тільки текст (без thinking-блоків), тож її можна вільно обрізати.
import Anthropic from "@anthropic-ai/sdk";
import { ymd } from "../dates";
import { addChat, listChat, type ChatAction } from "../repo/chat";
import { getClientRow } from "../repo/clients";
import { getApiKey } from "../secrets";
import { agentConfig } from "./config";
import { runTool, TOOLS } from "./tools";

export class NoKeyError extends Error {}

const MAX_STEPS = 15;
const HISTORY = 30;

// Стабільна частина — кешується між запитами
const SYSTEM = `Ти — помічник Саші в його системі client-ops. Саша веде клієнтів: Facebook-реклама, сайти, налаштування відділів продажу (CRM, телефонія, навчання менеджерів).
Мета — економити Саші час: пам'ятати все по клієнтах, тримати задачі в порядку, пропонувати наступні кроки, повторно використовувати плейбуки.

Як працювати:
- Пиши українською, на «ти», коротко і по ділу. Багато тексту тільки коли Саша просить детально.
- Факти бери тільки з бази через інструменти. Не вигадуй цифри, дати, імена. Чого нема в базі — так і скажи.
- Перш ніж відповідати про клієнта — подивись його картку (get_client). Якщо не знаєш ID — search або list_clients.
- Коли Саша каже щось зробити (створити задачу, закрити, записати, оновити) — роби це інструментами одразу і коротко підтвердь.
- Коли Саша вставляє переписку з клієнтом чи звіт: збережи як матеріал, витягни потреби/домовленості (онови картку), сформуй задачі з дедлайнами, запиши ідеї. Потім коротко перелічи, що зробив.
- Цифри з рекламного кабінету — записуй через add_ad_stats з правильним періодом.
- Саша часто ДИКТУЄ голосом: текст може бути без розділових знаків, з помилками розпізнавання і «е-е». Розумій суть, не перепитуй дрібниці.
- Коли Саша надиктовує нового клієнта чи проєкт: спершу search (чи нема вже такого), потім create_client з усіма полями, які прозвучали (власник, вид бізнесу в niche, скільки точок, місто, телефон, потреби, бюджет, оплата, бачення, наступний крок; статус lead, якщо ще не домовились, active + work_since — якщо вже працюємо). Кожну послугу, яку ми робимо (реклама Meta/Google/TikTok, сайт, CRM, телефонія, навчання, автоматизація), — set_service з усім, що відомо (яка CRM, на чому сайт, кабінет, бюджет). Потім задачі з дедлайнами, ідеї; якщо підходить плейбук (list_playbooks) — підключи. В кінці коротко: що створив і чого бракує (одним рядком).
- Дати пиши YYYY-MM-DD для інструментів; «завтра», «в п'ятницю» рахуй від сьогоднішньої дати.
- Пошта: читати листування з клієнтом можеш (mail_search, mail_read), НАДСИЛАТИ листи — ні: пиши чернетку, Саша надішле сам у вкладці «Пошта».
- Видаляти дані ти не можеш — якщо Саша просить видалити, скажи, де це зробити в інтерфейсі.
- Паролі в базу НЕ записуй ніколи. Якщо в тексті є пароль чи токен — не зберігай його, порадь покласти в Bitwarden і записати лише назву запису.
- Будь чесним: якщо ідея слабка або є ризик — скажи прямо.`;

function contextBlock(clientId: number | null, page: string): string {
  const d = new Date();
  const today = `${ymd(d)} (${d.toLocaleDateString("uk-UA", { weekday: "long" })})`;
  const c = clientId ? getClientRow(clientId) : null;
  const where = page ? ` Саша зараз на сторінці «${page}».` : "";
  return c
    ? `Сьогодні ${today}. Розмова в картці клієнта «${c.name}» (client_id ${c.id}) — за замовчуванням мова про нього.${where}`
    : `Сьогодні ${today}. Загальна розмова, не прив'язана до клієнта.${where}`;
}

export async function runAgent(clientId: number | null, userText: string, page = ""): Promise<{ reply: string; actions: ChatAction[] }> {
  const key = getApiKey();
  if (!key) throw new NoKeyError("Нема ключа Anthropic API");
  const client = new Anthropic({ apiKey: key });

  const history: Anthropic.Beta.BetaMessageParam[] = listChat(clientId, HISTORY).map((m) => ({ role: m.role, content: m.content }));
  // Історія має починатися з user
  while (history.length && history[0].role !== "user") history.shift();
  const messages: Anthropic.Beta.BetaMessageParam[] = [...history, { role: "user", content: userText }];
  const cfg = agentConfig();
  const stable = cfg.instructions.trim() ? `${SYSTEM}\n\nДодаткові інструкції від Саші:\n${cfg.instructions.trim()}` : SYSTEM;
  const system: Anthropic.Beta.BetaTextBlockParam[] = [
    { type: "text", text: stable, cache_control: { type: "ephemeral" } },
    { type: "text", text: contextBlock(clientId, page) },
  ];

  const ctx = { actions: [] as ChatAction[] };
  let reply = "";

  for (let step = 0; step < MAX_STEPS; step++) {
    const res = await client.beta.messages.create({
      model: cfg.model,
      max_tokens: 16000,
      system,
      tools: TOOLS,
      messages,
      output_config: { effort: cfg.effort },
      // Якщо модель відмовить з міркувань безпеки — API сам спробує іншу (де це підтримується)
      ...(cfg.fallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    });

    if (res.stop_reason === "refusal") {
      reply = "Цей запит модель відхилила. Переформулюй, будь ласка.";
      break;
    }

    // Весь вміст (разом з thinking) повертаємо як є — в межах ходу історія тільки доповнюється
    messages.push({ role: "assistant", content: res.content as Anthropic.Beta.BetaContentBlockParam[] });
    const text = res.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join("\n").trim();
    if (text) reply = text;

    if (res.stop_reason === "pause_turn") continue;
    if (res.stop_reason !== "tool_use") break;

    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const block of res.content) {
      if (block.type !== "tool_use") continue;
      try {
        const out = await runTool(block.name, (block.input ?? {}) as Record<string, unknown>, ctx);
        results.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(out ?? null) });
      } catch (e) {
        results.push({ type: "tool_result", tool_use_id: block.id, content: e instanceof Error ? e.message : String(e), is_error: true });
      }
    }
    messages.push({ role: "user", content: results });
    if (step === MAX_STEPS - 1) reply = reply || "Зупинився: забагато кроків. Уточни запит.";
  }

  if (!reply) reply = ctx.actions.length ? "Готово." : "Нема відповіді.";
  addChat(clientId, "user", userText);
  addChat(clientId, "assistant", reply, ctx.actions);
  return { reply, actions: ctx.actions };
}
