// Профіль спілкування з клієнтом: Джері читає переписку групи і коротко записує, як з цим клієнтом говорити.
// Ручну правку Саші автоматика не перезаписує (source manual). Тумблер auto.comm_profile — сам при першій чернетці / коли набралось багато нових повідомлень.
import Anthropic from "@anthropic-ai/sdk";
import { ai } from "./ai";
import { agentConfig } from "./agent/config";
import { autoOn } from "./agent/caps";
import { logError } from "./log";
import { getClientRow } from "./repo/clients";
import { countClientTexts, getComm, saveComm } from "./repo/comm";
import { clientMessages } from "./repo/telegram";
import { getApiKey } from "./secrets";

const MIN_MESSAGES = 8;
const REFRESH_AFTER = 40; // нових повідомлень — тоді авто-профіль оновлюється

export async function buildCommProfile(clientId: number): Promise<{ ok: true; profile: string } | { ok: false; error: string }> {
  const key = getApiKey();
  if (!key) return { ok: false, error: "Нема ключа Anthropic" };
  const c = getClientRow(clientId);
  if (!c) return { ok: false, error: "Клієнта нема" };
  const total = countClientTexts(clientId);
  if (total < MIN_MESSAGES) return { ok: false, error: `Замало переписки (${total}) — привʼяжи Telegram-групу або імпортуй історію, або впиши профіль руками` };
  const chat = clientMessages(clientId, { limit: 300 }).filter((m) => m.text?.trim())
    .map((m) => `[${m.sent_at.slice(0, 10)}] ${m.is_owner ? "Саша" : m.from_name}: ${m.text.replace(/\s+/g, " ").slice(0, 400)}`).join("\n").slice(-24000);
  const system = `Ти допомагаєш Саші (маркетолог/інтегратор) спілкуватись з клієнтом. Прочитай переписку з групи і склади КОРОТКИЙ профіль спілкування — тільки те, що видно з переписки, без вигадок. Якщо щось не видно — пропусти пункт.
Формат (прості рядки, без markdown-заголовків):
Звертання: як Саша звертається до клієнта і клієнт до Саші (ім'я, ти/ви).
Хто вирішує: хто в групі ЛПР, хто ще пише і за що відповідає.
Тон і довжина: як клієнт пише (коротко/розлого, емодзі, голосові), який тон спрацьовує.
Що цікавить: на що клієнт реагує (заявки, гроші, терміни, якість, ціна ліда…).
Чого уникати: що дратувало, на що скаржився, де були непорозуміння.
Як реагує на звіти: читає/питає/ігнорує, що перепитує.
Відкриті питання: що клієнт питав і не отримав відповіді (якщо видно).
Максимум 12 рядків. Українською.`;
  try {
    const r = await ai("профіль спілкування", { apiKey: key, timeout: 90000, maxRetries: 1 }).messages.create({
      model: agentConfig().model, max_tokens: 1200, system,
      messages: [{ role: "user", content: `Клієнт: ${c.name}${c.owner_name ? ` (власник/контакт: ${c.owner_name})` : ""}\n\nПереписка (старі → нові):\n${chat}` }],
    });
    const profile = r.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("").trim();
    if (!profile) return { ok: false, error: "Порожня відповідь" };
    saveComm(clientId, profile, "auto", total);
    return { ok: true, profile };
  } catch (e) {
    logError("comm-profile", e);
    return { ok: false, error: "Не вдалось скласти профіль — спробуй ще раз" };
  }
}

// Профіль для чернетки: якщо авто і застарів (чи нема) — оновити; ручний не чіпаємо
export async function commProfileFor(clientId: number): Promise<string> {
  const cur = getComm(clientId);
  if (autoOn("comm_profile") && cur?.source !== "manual") {
    const total = countClientTexts(clientId);
    const stale = !cur?.profile || total - (cur?.messages_seen ?? 0) >= REFRESH_AFTER;
    if (stale && total >= MIN_MESSAGES) {
      const r = await buildCommProfile(clientId);
      if (r.ok) return r.profile;
    }
  }
  return cur?.profile ?? "";
}
