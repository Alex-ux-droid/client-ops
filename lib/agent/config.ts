// Налаштування помічника: зберігаються в таблиці settings, за замовчуванням — з .env.
import { getSetting, setSetting } from "../repo/settings";

export const EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;
export type Effort = (typeof EFFORTS)[number];

export const EFFORT_LABEL: Record<Effort, string> = {
  low: "Низька — швидко і дешево",
  medium: "Середня — баланс (рекомендую)",
  high: "Висока — уважніше, дорожче",
  xhigh: "Дуже висока",
  max: "Максимальна — повільно і дорого",
};

// Відомі моделі (якщо API не віддав список). Ціни — $ за 1М токенів вхід/вихід.
export const KNOWN_MODELS = [
  { id: "claude-sonnet-5-5", name: "Claude Sonnet 5.5", note: "щоденна робота · $2 / $10" },
  { id: "claude-opus-5-5", name: "Claude Opus 5.5", note: "складні задачі · $4 / $20" },
  { id: "claude-haiku-5-5", name: "Claude Haiku 5.5", note: "найдешевша, проста робота · $0.10 / $0.50" },
  { id: "claude-fable-5-1", name: "Claude Fable 5.1", note: "найпотужніша, дорога · $10 / $50" },
];

// Моделі, для яких API підтримує автоматичний запасний варіант при відмові
const FALLBACK_MODELS = new Set(["claude-fable-5-1", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"]);

export type AgentConfig = { model: string; effort: Effort; instructions: string; fallback: boolean };

export function agentConfig(): AgentConfig {
  const model = getSetting("agent.model") || process.env.AGENT_MODEL?.trim() || "claude-sonnet-5-5";
  const e = getSetting("agent.effort");
  return {
    model,
    effort: (EFFORTS as readonly string[]).includes(e ?? "") ? (e as Effort) : "medium",
    instructions: getSetting("agent.instructions") ?? "",
    fallback: FALLBACK_MODELS.has(model),
  };
}

export function saveAgentConfig(c: { model: string; effort: string; instructions: string }): void {
  if (/^claude-[a-z0-9.-]+$/.test(c.model)) setSetting("agent.model", c.model);
  if ((EFFORTS as readonly string[]).includes(c.effort)) setSetting("agent.effort", c.effort);
  setSetting("agent.instructions", c.instructions.slice(0, 8000));
}

// Пам'ять помічника: що він дізнався про Сашу і роботу. Помічник доповнює сам, Саша може редагувати.
const MEMORY_LIMIT = 8000;
export function agentMemory(): string {
  return getSetting("agent.memory") ?? "";
}
export function setAgentMemory(text: string): void {
  setSetting("agent.memory", text.slice(0, MEMORY_LIMIT));
}
export function addAgentMemory(note: string): number {
  const line = `- ${new Date().toISOString().slice(0, 10)}: ${note.trim().replace(/\n+/g, " ")}`;
  const next = `${agentMemory().trim()}\n${line}`.trim();
  setAgentMemory(next);
  return next.length;
}
export const MEMORY_MAX = MEMORY_LIMIT;
