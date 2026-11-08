// Підпис і перевірка сесійної куки. Без БД: кука = "термін.підпис".
import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "co_session";
export const SESSION_DAYS = 7;

// Логін вимкнено тільки локально, коли пароль не задано.
export function authDisabled(): boolean {
  return !process.env.APP_PASSWORD && process.env.NODE_ENV !== "production";
}

function secret(): string | null {
  const s = process.env.SESSION_SECRET;
  return s && s.length >= 32 ? s : null;
}

// «Вийти всюди» = нова епоха (SESSION_EPOCH у .env): усі старі підписи перестають збігатися.
// Порожня епоха — підпис як раніше (щоб оновлення не викинуло всіх).
function sign(payload: string, key: string): string {
  const epoch = process.env.SESSION_EPOCH || "";
  return createHmac("sha256", key).update(epoch ? `${payload}.${epoch}` : payload).digest("base64url");
}

export const IDLE_MIN = 30;

// Кука: "термін.режим.підпис". Режим r — «запамʼятати пристрій» (7 днів), i — чужий компʼютер:
// живе 30 хв і продовжується на кожен запит (proxy), без дій — вихід. Старі куки "термін.підпис" = r.
export function createSession(remember = false): string | null {
  const key = secret();
  if (!key) return null;
  const mode = remember ? "r" : "i";
  const expires = String(Date.now() + (remember ? SESSION_DAYS * 86400_000 : IDLE_MIN * 60_000));
  return `${expires}.${mode}.${sign(`${expires}.${mode}`, key)}`;
}

export function parseSession(token: string | undefined): { ok: boolean; mode: "r" | "i"; expires: number } {
  const bad = { ok: false, mode: "r" as const, expires: 0 };
  const key = secret();
  if (!key || !token) return bad;
  const parts = token.split(".");
  const [expires, mode, sig] = parts.length === 3 ? parts : [parts[0], "", parts[1]];
  if (!expires || !sig || Number(expires) < Date.now()) return bad;
  // старі куки на 30 днів — не довше 7 днів від зараз (після переходу на 7 днів)
  if (Number(expires) > Date.now() + (SESSION_DAYS * 86400_000 + 3600_000)) return bad;
  const payload = mode ? `${expires}.${mode}` : expires;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(payload, key));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return bad;
  return { ok: true, mode: mode === "i" ? "i" : "r", expires: Number(expires) };
}

export function verifySession(token: string | undefined): boolean {
  if (authDisabled()) return true;
  return parseSession(token).ok;
}

// Окремий ключ доступу для Claude (заголовок Authorization: Bearer ...). Пароль входу йому не потрібен.
// Має термін: AGENT_TOKEN_EXPIRES (мс) у .env; минув — ключ не діє, Саша генерує новий у Налаштуваннях.
export function agentTokenMatches(header: string | null | undefined): boolean {
  const real = process.env.AGENT_TOKEN;
  const exp = Number(process.env.AGENT_TOKEN_EXPIRES || 0);
  if (exp && exp < Date.now()) return false;
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
