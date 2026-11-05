// Попросити модель повернути JSON (розбір витяжок). Потоково — щоб великі відповіді не обривались по таймауту;
// ліміт 32k токенів (кирилиця ≈ 2 символи на токен, тож 8k обрізали великі витяжки посередині).
import Anthropic from "@anthropic-ai/sdk";
import { agentConfig } from "./agent/config";
import { getApiKey } from "./secrets";

export class LlmJsonError extends Error {}

function parseLoose<T>(out: string): T {
  const t = out.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const a = t.indexOf("{"), z = t.lastIndexOf("}");
  if (a < 0 || z <= a) throw new LlmJsonError("Модель не повернула JSON — спробуй ще раз");
  const body = t.slice(a, z + 1);
  try { return JSON.parse(body) as T; } catch {
    // дрібні огріхи: коми перед ] або }
    return JSON.parse(body.replace(/,\s*([\]}])/g, "$1")) as T;
  }
}

export async function askJson<T>(system: string, user: string, opts: { maxTokens?: number; effort?: "low" | "medium" | "high" } = {}): Promise<T> {
  const key = getApiKey();
  if (!key) throw new LlmJsonError("Нема ключа Anthropic (Налаштування → Доступи)");
  const client = new Anthropic({ apiKey: key, timeout: 600_000, maxRetries: 1 });
  const msg = await client.messages.stream({
    model: agentConfig().model, max_tokens: opts.maxTokens ?? 32000, system, output_config: { effort: opts.effort ?? "low" },
    messages: [{ role: "user", content: user }],
  }).finalMessage();
  const out = msg.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
  if (msg.stop_reason === "max_tokens") throw new LlmJsonError("Витяжка завелика — розбий її на 2 частини (напр. окремо хронологію) і встав по черзі");
  return parseLoose<T>(out);
}

export const llmErrorText = (e: unknown) =>
  e instanceof LlmJsonError ? e.message
  : (e as { status?: number }).status === 401 ? "Ключ Anthropic не підходить"
  : e instanceof SyntaxError ? "Модель повернула зламану відповідь — спробуй ще раз"
  : "Не вдалось розібрати — спробуй ще раз";
