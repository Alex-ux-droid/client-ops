// Джері сам поповнює базу порад, коли нових лишається мало. Пише під реакції Саші:
// теми з «нове/детальніше» — більше і глибше, «не цікаво» — менше, «знав» — рівень вище.
import Anthropic from "@anthropic-ai/sdk";
import { agentConfig, agentMemory } from "./agent/config";
import { autoOn } from "./agent/caps";
import { logError } from "./log";
import { getSetting, setSetting } from "./repo/settings";
import { addTip, reactedTips, TIP_TOPICS, tipTitles, topicScores, unseenCount } from "./repo/tips";
import { getApiKey } from "./secrets";

const LOW = 8, BATCH = 15, GAP_H = 6;

const PROMPT = `Ти — Джері, права рука Саші. Саша веде клієнтів: реклама Meta, сайти, налаштування відділів продажу (CRM, телефонія, навчання менеджерів), будує свої продукти.
Напиши ${BATCH} нових коротких порад, які Джері покаже під час роботи. Мета — щоб Саша став сильнішим у бізнесі, маркетингу, продажах і переговорах і міг одразу застосувати це з клієнтами.

Правила:
- Українською, на «ти», просто, без води і канцеляриту. Заголовок до 60 символів, текст 2–4 речення (до 400 символів).
- Кожна порада — одна думка + як застосувати в роботі Саші (клієнт, реклама, дзвінок, переговори, ціна).
- Лише перевірені факти. Якщо посилаєшся на дослідження чи книгу — тільки справжні (автор, назва). Не вигадуй цифр; орієнтири позначай як орієнтир.
- Терміни пояснюй простими словами з прикладом на цифрах.
- Не повторюй уже наявні заголовки і ті самі думки іншими словами.
- Теми (topic): ${Object.entries(TIP_TOPICS).map(([k, v]) => `${k} (${v})`).join(", ")}.

Відповідай ТІЛЬКИ JSON-масивом без markdown: [{"topic": "...", "title": "...", "body": "..."}, ...]`;

export async function generateTips(): Promise<number> {
  const key = getApiKey();
  if (!key) throw new Error("Нема ключа Anthropic — Налаштування → Доступи");
  const sc = topicScores();
  const taste = Object.entries(sc).map(([k, v]) => `${k}: нове ${v.new}, детальніше ${v.more}, знав ${v.knew}, не цікаво ${v.boring}`).join("\n");
  const ctx = [
    `Реакції Саші по темах (більше пиши там, де «нове/детальніше»; де «знав» — глибше, рівнем вище; де «не цікаво» — мінімум):\n${taste}`,
    `Сподобалось (нове/детальніше): ${[...reactedTips("new"), ...reactedTips("more")].map((t) => t.title).join("; ") || "поки нема"}`,
    `Вже знав: ${reactedTips("knew").map((t) => t.title).join("; ") || "поки нема"}`,
    `Не цікаво: ${reactedTips("boring").map((t) => t.title).join("; ") || "поки нема"}`,
    `Що Джері знає про Сашу (памʼять):\n${agentMemory().slice(0, 3000) || "—"}`,
    `Уже є (не повторюй):\n${tipTitles().join("\n")}`,
  ].join("\n\n");
  const client = new Anthropic({ apiKey: key });
  const res = await client.messages.create({
    model: agentConfig().model, max_tokens: 6000, system: PROMPT, output_config: { effort: "low" },
    messages: [{ role: "user", content: ctx }],
  });
  const out = res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
  let list: { topic?: string; title?: string; body?: string }[] = [];
  try { list = JSON.parse(out.slice(out.indexOf("["), out.lastIndexOf("]") + 1)); } catch { throw new Error("Джері повернув поради не в тому форматі"); }
  let added = 0;
  for (const t of list) if (addTip({ topic: String(t.topic ?? ""), title: String(t.title ?? ""), body: String(t.body ?? ""), source: "jerry" })) added++;
  return added;
}

// З годинника: нових мало → допиши пачку (не частіше ніж раз на 6 год, тільки з ключем і з увімкненим тумблером)
export async function tipsTick(): Promise<void> {
  if (!autoOn("tips") || !autoOn("tips_gen") || !getApiKey()) return;
  if (unseenCount() >= LOW) return;
  const last = Number(getSetting("tips.gen_at")) || 0;
  if (Date.now() - last < GAP_H * 3600_000) return;
  setSetting("tips.gen_at", String(Date.now()));
  await generateTips().catch((e) => logError("tips-gen", e));
}
