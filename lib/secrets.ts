// Ключі живуть тільки в .env. Сторінка «Налаштування» дописує ключ у .env на сервері
// і одразу кладе його в process.env, без перезапуску.
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ENV_FILE = path.join(process.cwd(), ".env");

export function getApiKey(): string | null {
  return process.env.ANTHROPIC_API_KEY?.trim() || null;
}

export function maskKey(key: string | null): string {
  return key ? `${key.slice(0, 10)}…${key.slice(-4)}` : "";
}

// Записати (або прибрати, value = null) змінну в .env і в поточний процес
export function setEnvVar(name: string, value: string | null): void {
  const re = new RegExp(`^${name}=.*\\n?`, "m");
  let text = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, "utf8") : "";
  text = text.replace(re, "");
  if (value !== null) text = `${text.replace(/\n?$/, "\n")}${name}=${value}\n`.replace(/^\n/, "");
  fs.writeFileSync(ENV_FILE, text, { mode: 0o600 });
  if (value === null) delete process.env[name];
  else process.env[name] = value;
}

export function saveApiKey(key: string): void {
  setEnvVar("ANTHROPIC_API_KEY", key);
}

export function hasAgentToken(): boolean {
  return (process.env.AGENT_TOKEN?.length ?? 0) >= 32;
}

export function createAgentToken(): string {
  const token = randomBytes(32).toString("hex");
  setEnvVar("AGENT_TOKEN", token);
  return token;
}

export function revokeAgentToken(): void {
  setEnvVar("AGENT_TOKEN", null);
}
