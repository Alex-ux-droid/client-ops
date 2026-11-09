// Памʼять Джері на 90%+ → стискаємо у фоні: повна стара версія йде в архів (settings agent.memory_archive),
// модель зливає дублі й прибирає застаріле, результат ≤ 60% ліміту. Нічого не губиться: архів можна перечитати.
import Anthropic from "@anthropic-ai/sdk";
import { ai } from "../ai";
import { logError } from "../log";
import { getSetting, setSetting } from "../repo/settings";
import { getApiKey } from "../secrets";
import { agentConfig, agentMemory, MEMORY_MAX, setAgentMemory } from "./config";

const g = globalThis as unknown as { __memCompress?: boolean };
const ARCHIVE_MAX = 200_000;

export function archiveMemory(text: string): void {
  const prev = getSetting("agent.memory_archive") ?? "";
  const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
  setSetting("agent.memory_archive", `${`=== ${stamp} ===\n${text}\n\n${prev}`.slice(0, ARCHIVE_MAX)}`);
}

const FAIL_KEY = "agent.memory_compress_fail_at";
const COOLDOWN_MS = 60 * 60 * 1000; // після невдачі — не пробувати годину (раніше смикалось на кожну розмову і плодило копії в архіві)

async function squeeze(key: string, text: string, target: number): Promise<string> {
  const res = await ai("памʼять (стиснення)", { apiKey: key, timeout: 120_000, maxRetries: 1 }).messages.create({
    model: agentConfig().model, max_tokens: 8000, output_config: { effort: "medium" },
    system: `Ти стискаєш робочу памʼять помічника Джері (про Сашу і його роботу). ЖОРСТКИЙ ЛІМІТ: не більше ${target} символів разом з пробілами (зараз ${text.length}). Збережи структуру розділів «## …». Злий дублі й повтори в одне, прибери застаріле й виконане, переформулюй коротше (один пункт — один рядок). Якщо не влазить — викидай найменш важливе, але лімітом не жертвуй. Нічого не вигадуй. Відповідь — ТІЛЬКИ новий текст памʼяті.`,
    messages: [{ role: "user", content: text }],
  });
  return res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("").trim();
}

// source — текст, який треба стиснути (за замовчуванням поточна памʼять).
// До 3 проходів: кожен наступний стискає результат попереднього з жорсткішою ціллю.
export async function compressMemory(source?: string): Promise<boolean> {
  const key = getApiKey();
  if (!key || g.__memCompress) return false;
  const failedAt = Date.parse(getSetting(FAIL_KEY) ?? "");
  if (failedAt && Date.now() - failedAt < COOLDOWN_MS) return false;
  g.__memCompress = true;
  try {
    const text = source ?? agentMemory();
    archiveMemory(text);
    let cur = text;
    for (const share of [0.6, 0.5, 0.4]) {
      const out = await squeeze(key, cur, Math.round(MEMORY_MAX * share));
      if (out && out.includes("##") && out.length <= MEMORY_MAX) { setAgentMemory(out); setSetting(FAIL_KEY, ""); return true; }
      if (out && out.includes("##") && out.length < cur.length) cur = out; // коротше, але ще не влазить — стискаємо далі вже його
    }
    setSetting(FAIL_KEY, new Date().toISOString());
    logError("memory-compress", new Error(`Стиснення не вдалось за 3 спроби (лишилось ${cur.length} з ліміту ${MEMORY_MAX} симв.) — стара памʼять у архіві, наступна спроба через годину`));
    return false;
  } catch (e) {
    setSetting(FAIL_KEY, new Date().toISOString());
    logError("memory-compress", e);
    return false;
  } finally {
    g.__memCompress = false;
  }
}

export const memoryNearlyFull = (len = agentMemory().length) => len >= MEMORY_MAX * 0.9;
