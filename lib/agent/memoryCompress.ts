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

// source — текст, який треба стиснути (за замовчуванням поточна памʼять)
export async function compressMemory(source?: string): Promise<boolean> {
  const key = getApiKey();
  if (!key || g.__memCompress) return false;
  g.__memCompress = true;
  try {
    const text = source ?? agentMemory();
    archiveMemory(text);
    const target = Math.round(MEMORY_MAX * 0.6);
    const res = await ai("памʼять (стиснення)", { apiKey: key, timeout: 120_000, maxRetries: 1 }).messages.create({
      model: agentConfig().model, max_tokens: 8000, output_config: { effort: "low" },
      system: `Ти стискаєш робочу памʼять помічника Джері (про Сашу і його роботу). Збережи структуру розділів «## …». Злий дублі й повтори в одне, прибери застаріле й виконане, залиш суть: факти, правила, уроки, цілі, поточний фокус. Нічого не вигадуй. Результат — до ${target} символів. Відповідь — ТІЛЬКИ новий текст памʼяті.`,
      messages: [{ role: "user", content: text }],
    });
    const out = res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("").trim();
    if (!out || out.length > MEMORY_MAX || !out.includes("##")) { logError("memory-compress", new Error(`Стиснення не вдалось (${out.length} симв.) — стара памʼять у архіві`)); return false; }
    setAgentMemory(out);
    return true;
  } catch (e) {
    logError("memory-compress", e);
    return false;
  } finally {
    g.__memCompress = false;
  }
}

export const memoryNearlyFull = (len = agentMemory().length) => len >= MEMORY_MAX * 0.9;
