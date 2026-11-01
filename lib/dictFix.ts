// Причесати надиктований текст: розділові знаки, великі літери, явні помилки розпізнавання,
// власні назви — точно як у словнику («10 про вектор» → ProVector). Зміст і стиль не чіпаємо.
import Anthropic from "@anthropic-ai/sdk";
import { autoOn } from "./agent/caps";
import { logError } from "./log";
import { vocabulary } from "./repo/vocab";
import { getApiKey } from "./secrets";

const MODEL = "claude-haiku-5-5";

export async function fixDictation(raw: string): Promise<string> {
  const text = raw.trim();
  const key = getApiKey();
  if (!text || text.length < 3 || !key || !autoOn("dict_fix")) return text;
  const vocab = vocabulary();
  const system = `Ти коректор надиктованого тексту (розпізнавання мови, переважно українська, бувають англійські слова і назви).
Завдання: розстав розділові знаки і великі літери, розбий на речення, виправ очевидні помилки розпізнавання. Власні назви і бренди пиши точно як у словнику, навіть якщо розпізнавання записало їх на слух інакше (наприклад «про вектор», «10 про вектор», «провектор» → ProVector, якщо таке є в словнику). Англійські назви — латиницею.
НЕ змінюй зміст, порядок думок і стиль, нічого не додавай і не скорочуй, не перекладай, не відповідай на текст. Якщо це питання чи прохання — лиши його питанням чи проханням.
Поверни ТІЛЬКИ виправлений текст, без лапок і пояснень.
Словник назв: ${vocab.length ? vocab.join("; ") : "—"}`;
  try {
    const client = new Anthropic({ apiKey: key, timeout: 12000, maxRetries: 0 });
    const r = await client.messages.create({ model: MODEL, max_tokens: Math.min(4000, text.length * 2 + 200), system, messages: [{ role: "user", content: text }] });
    const out = r.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("").trim();
    // запобіжник: якщо модель «відповіла» замість виправити — повертаємо як було
    if (!out || out.length > text.length * 1.6 + 40 || out.length < text.length * 0.5) return text;
    return out;
  } catch (e) {
    logError("dict-fix", e);
    return text;
  }
}
