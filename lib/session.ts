// Підпис і перевірка сесійної куки. Без БД: кука = "термін.підпис".
import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "co_session";
export const SESSION_DAYS = 30;

// Логін вимкнено тільки локально, коли пароль не задано.
export function authDisabled(): boolean {
  return !process.env.APP_PASSWORD && process.env.NODE_ENV !== "production";
}

function secret(): string | null {
  const s = process.env.SESSION_SECRET;
  return s && s.length >= 32 ? s : null;
}

function sign(payload: string, key: string): string {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

export function createSession(): string | null {
  const key = secret();
  if (!key) return null;
  const expires = String(Date.now() + SESSION_DAYS * 86400_000);
  return `${expires}.${sign(expires, key)}`;
}

export function verifySession(token: string | undefined): boolean {
  if (authDisabled()) return true;
  const key = secret();
  if (!key || !token) return false;
  const [expires, sig] = token.split(".");
  if (!expires || !sig || Number(expires) < Date.now()) return false;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(expires, key));
  return a.length === b.length && timingSafeEqual(a, b);
}

// Окремий ключ доступу для Claude (заголовок Authorization: Bearer ...). Пароль входу йому не потрібен.
export function agentTokenMatches(header: string | null | undefined): boolean {
  const real = process.env.AGENT_TOKEN;
  const m = header?.match(/^Bearer\s+(.+)$/);
  if (!real || real.length < 32 || !m) return false;
  const a = createHmac("sha256", "cmp").update(m[1].trim()).digest();
  const b = createHmac("sha256", "cmp").update(real).digest();
  return timingSafeEqual(a, b);
}

// Сесія з куки або ключ Claude з заголовка
export function isAuthed(cookie: string | undefined, authorization: string | null | undefined): boolean {
  return verifySession(cookie) || agentTokenMatches(authorization);
}

export function passwordMatches(input: string): boolean {
  const real = process.env.APP_PASSWORD;
  if (!real) return false;
  const a = createHmac("sha256", "cmp").update(input).digest();
  const b = createHmac("sha256", "cmp").update(real).digest();
  return timingSafeEqual(a, b);
}
