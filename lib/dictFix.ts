// Причесати надиктований текст: ТІЛЬКИ розділові знаки, великі літери і власні назви зі словника
// («10 про вектор» → ProVector). Слова не міняємо — якщо модель змінила більше ~15% слів, лишаємо сирий текст.
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
  const system = `Ти розставляєш розділові знаки в надиктованому тексті (українська, бувають англійські слова).
ДОЗВОЛЕНО ТІЛЬКИ: крапки, коми, знаки питання, великі літери, абзаци; і назви зі словника — писати точно як у словнику, якщо в тексті очевидно саме вона (напр. «про вектор» → ProVector).
ЗАБОРОНЕНО: міняти, додавати, прибирати чи переставляти будь-які інші слова; «виправляти» стиль, суржик, повтори, граматику; перекладати; відповідати на текст.
Якщо сумніваєшся — лиши слово як є.
Поверни ТІЛЬКИ текст, без лапок і пояснень.
Словник назв: ${vocab.length ? vocab.join("; ") : "—"}`;
  try {
    const client = new Anthropic({ apiKey: key, timeout: 12000, maxRetries: 0 });
    const r = await client.messages.create({ model: MODEL, max_tokens: Math.min(4000, text.length * 2 + 200), system, messages: [{ role: "user", content: text }] });
    const out = r.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("").trim();
    // запобіжник: якщо модель «відповіла» замість виправити — повертаємо як було
    if (!out || out.length > text.length * 1.25 + 30 || out.length < text.length * 0.8) return text;
    // запобіжник: слова не мали змінитись (порівнюємо без розділових знаків і регістру; назви зі словника — дозволена різниця)
    const words = (x: string) => x.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
    const a = words(text), b = words(out);
    const pool = new Map<string, number>();
    for (const w of b) pool.set(w, (pool.get(w) ?? 0) + 1);
    let same = 0;
    for (const w of a) { const n = pool.get(w) ?? 0; if (n > 0) { same++; pool.set(w, n - 1); } }
    if (Math.abs(a.length - b.length) > Math.max(3, a.length * 0.1) || same < a.length * 0.85) return text;
    return out;
  } catch (e) {
    logError("dict-fix", e);
    return text;
  }
}
