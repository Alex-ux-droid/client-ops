// Повідомлення клієнту по шаблону: структура з msg_templates + загальні правила тону (settings msg.rules)
// + що відомо з бази (задача, знімок клієнта з Meta, як спілкуються в групі) → чернетка. Надсилає тільки Саша.
import Anthropic from "@anthropic-ai/sdk";
import { ai } from "./ai";
import { agentConfig } from "./agent/config";
import { clientSnapshot, taskSnapshot } from "./agent/context";
import { commProfileFor } from "./commProfile";
import { logError } from "./log";
import { getClientRow } from "./repo/clients";
import { getMsgTemplate, type MsgTemplate } from "./repo/msgTemplates";
import { getSetting } from "./repo/settings";
import { clientMessages } from "./repo/telegram";
import { getApiKey } from "./secrets";

export const MSG_RULES_DEFAULT = `- Пишемо від імені Саші, від першої особи («я»/«ми» — як він пише в групі). Звертання — як прийнято з цим клієнтом (на «ви», якщо не видно інакше).
- Коротко: клієнт читає з телефона. Кожен абзац — одна думка. Без води, без канцеляриту, без «радий повідомити».
- Говоримо про результат для бізнесу клієнта (заявки, гроші, час), а не про наші технічні дії. Терміни реклами (CTR, CPM, піксель, адсет) — людськими словами.
- Чесно: не обіцяти цифр, яких нема в даних. Не вигадувати факти — якщо чогось не знаєш, залиш [уточнити].
- Завжди закінчувати конкретикою: що далі і коли, або що потрібно від клієнта.
- Емодзі — мінімум (0–2), галочки-списки тільки якщо пунктів 3+.
- Не вставляти посилання на внутрішню систему, ID, назви задач.`;

export const msgRules = () => getSetting("msg.rules")?.trim() || MSG_RULES_DEFAULT;

// Блок для Джері в чаті: як писати клієнтам (шаблон + правила)
export function templateGuide(t: MsgTemplate): string {
  return `Шаблон «${t.title}» (${t.when_hint}).\nСтруктура:\n${t.guide}${t.example ? `\n\nПриклад вдалого повідомлення (стиль і довжина, НЕ копіювати факти):\n${t.example}` : ""}\n\nЗагальні правила:\n${msgRules()}`;
}

function tone(clientId: number): string {
  const msgs = clientMessages(clientId, { limit: 60 }).filter((m) => m.text?.trim() && m.kind === "text");
  if (!msgs.length) return "";
  return msgs.map((m) => `${m.is_owner ? "Саша" : m.from_name}: ${m.text.replace(/\s+/g, " ").slice(0, 300)}`).join("\n").slice(-6000);
}

export async function draftClientMessage(o: { clientId: number; taskId?: number | null; templateId: number; note?: string; previous?: string }): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const key = getApiKey();
  if (!key) return { ok: false, error: "Нема ключа Anthropic (Налаштування → Доступи)" };
  const t = getMsgTemplate(o.templateId);
  if (!t) return { ok: false, error: "Шаблону нема" };
  const c = getClientRow(o.clientId);
  if (!c) return { ok: false, error: "Клієнта нема" };
  const task = o.taskId ? taskSnapshot(o.taskId) : null;
  const chat = tone(o.clientId);
  const profile = await commProfileFor(o.clientId);
  const system = `Ти пишеш повідомлення клієнту від імені Саші (маркетолог/інтегратор: реклама Meta, сайти, відділи продажу). Мова — українська.
${templateGuide(t)}

Поверни ТІЛЬКИ текст повідомлення, готовий до відправки в Telegram: без лапок, без markdown-заголовків і **жирного** (Telegram-група показує їх як є), без пояснень до нього.`;
  const user = [
    `Клієнт: ${c.name}${c.owner_name ? `, власник/контакт: ${c.owner_name}` : ""}${c.niche ? `, ніша: ${c.niche}` : ""}`,
    task ? `Задача, по якій пишемо (галочки [x] — зроблено, [ ] — ще ні; про незроблене не пиши як про зроблене):\n${task.text}` : "",
    profile ? `ПРОФІЛЬ СПІЛКУВАННЯ з цим клієнтом (звертання і тон бери звідси):\n${profile}` : "",
    clientSnapshot(o.clientId),
    chat ? `Останні повідомлення в групі з клієнтом (щоб попасти в тон і звертання; не повторюй те, що вже писали):\n${chat}` : "Переписки з клієнтом у системі нема — тон нейтрально-дружній, на «ви».",
    o.note?.trim() ? `Що Саша хоче сказати / уточнення (головне, має бути в тексті):\n${o.note.trim()}` : "",
    o.previous?.trim() ? `Попередня чернетка (Саша хоче інший варіант — врахуй його уточнення вище):\n${o.previous.trim()}` : "",
  ].filter(Boolean).join("\n\n");
  try {
    const cfg = agentConfig();
    const client = ai("повідомлення клієнту", { apiKey: key, timeout: 90000, maxRetries: 1 });
    const r = await client.messages.create({ model: cfg.model, max_tokens: 2000, system, messages: [{ role: "user", content: user }] });
    const text = r.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("").trim();
    return text ? { ok: true, text } : { ok: false, error: "Порожня відповідь" };
  } catch (e) {
    logError("client-message", e);
    const st = (e as { status?: number }).status;
    return { ok: false, error: st === 401 ? "Ключ Anthropic не підходить (Налаштування → Доступи)" : st === 429 ? "Забагато запитів — спробуй за хвилину" : st === 400 && /credit/i.test(String(e)) ? "Закінчились кредити API (platform.claude.com)" : "Не вдалось скласти — спробуй ще раз" };
  }
}
