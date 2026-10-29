// Ключі живуть тільки в .env. Сторінка «Налаштування» дописує ключ у .env на сервері
// і одразу кладе його в process.env, без перезапуску.
import fs from "node:fs";
import path from "node:path";

const ENV_FILE = path.join(process.cwd(), ".env");

export function getApiKey(): string | null {
  return process.env.ANTHROPIC_API_KEY?.trim() || null;
}

export function maskKey(key: string | null): string {
  return key ? `${key.slice(0, 10)}…${key.slice(-4)}` : "";
}

export function agentModel(): string {
  return process.env.AGENT_MODEL?.trim() || "claude-sonnet-5-5";
}

export function saveApiKey(key: string): void {
  const line = `ANTHROPIC_API_KEY=${key}`;
  const old = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, "utf8") : "";
  const next = /^ANTHROPIC_API_KEY=.*$/m.test(old)
    ? old.replace(/^ANTHROPIC_API_KEY=.*$/m, line)
    : `${old.replace(/\n?$/, "\n")}${line}\n`;
  fs.writeFileSync(ENV_FILE, next, { mode: 0o600 });
  process.env.ANTHROPIC_API_KEY = key;
}
