// Google: вхід (OAuth), Диск (папки клієнтів), Gmail (читання і відправка).
// Без бібліотек — прямі запити до REST API. Секрети (client secret, refresh token) — тільки в .env.
import { getSetting, setSetting } from "./repo/settings";
import { setEnvVar } from "./secrets";

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/calendar.events",
];
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

export class GoogleReconnectError extends Error {}

const env = (k: string) => process.env[k]?.trim() || "";
export const googleConfigured = () => !!(env("GOOGLE_CLIENT_ID") && env("GOOGLE_CLIENT_SECRET"));
export const googleConnected = () => googleConfigured() && !!env("GOOGLE_REFRESH_TOKEN");

export function googleStatus() {
  return {
    configured: googleConfigured(),
    connected: googleConnected(),
    clientId: env("GOOGLE_CLIENT_ID"),
    email: getSetting("google.email") ?? "",
    connectedAt: getSetting("google.connected_at") ?? "",
    error: getSetting("google.error") ?? "",
    calendar: calendarAllowed(),
  };
}

export function saveGoogleClient(clientId: string, secret: string): void {
  setEnvVar("GOOGLE_CLIENT_ID", clientId.trim());
  if (secret.trim()) setEnvVar("GOOGLE_CLIENT_SECRET", secret.trim());
}

export function authUrl(redirectUri: string, state: string): string {
  const q = new URLSearchParams({
    client_id: env("GOOGLE_CLIENT_ID"),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

type TokenResponse = { access_token: string; expires_in: number; refresh_token?: string; id_token?: string; scope?: string; error?: string; error_description?: string };

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: env("GOOGLE_CLIENT_ID"), client_secret: env("GOOGLE_CLIENT_SECRET"), ...body }),
  });
  return (await r.json()) as TokenResponse;
}

const g = globalThis as unknown as { __gtoken?: { token: string; until: number } };

export async function finishAuth(code: string, redirectUri: string): Promise<string> {
  const t = await tokenRequest({ code, redirect_uri: redirectUri, grant_type: "authorization_code" });
  if (!t.access_token) throw new Error(t.error_description || t.error || "Google не видав токен");
  if (!t.refresh_token) throw new Error("Google не видав постійний доступ. Відключи доступ у myaccount.google.com → Безпека → Сторонні застосунки і підключи знову.");
  setEnvVar("GOOGLE_REFRESH_TOKEN", t.refresh_token);
  g.__gtoken = { token: t.access_token, until: Date.now() + (t.expires_in - 60) * 1000 };
  const me = (await (await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { authorization: `Bearer ${t.access_token}` } })).json()) as { email?: string };
  setSetting("google.email", me.email ?? "");
  setSetting("google.connected_at", new Date().toISOString());
  setSetting("google.scopes", t.scope ?? "");
  setSetting("google.error", "");
  return me.email ?? "";
}

export async function disconnectGoogle(): Promise<void> {
  const rt = env("GOOGLE_REFRESH_TOKEN");
  if (rt) await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(rt)}`, { method: "POST" }).catch(() => {});
  setEnvVar("GOOGLE_REFRESH_TOKEN", null);
  g.__gtoken = undefined;
  setSetting("google.email", "");
}

async function accessToken(): Promise<string> {
  if (!googleConnected()) throw new GoogleReconnectError("Google не підключено");
  if (g.__gtoken && g.__gtoken.until > Date.now()) return g.__gtoken.token;
  const t = await tokenRequest({ refresh_token: env("GOOGLE_REFRESH_TOKEN"), grant_type: "refresh_token" });
  if (!t.access_token) {
    // invalid_grant: токен відкликано або минув (тестовий режим Google — 7 днів)
    setSetting("google.error", t.error === "invalid_grant" ? "Доступ Google закінчився — натисни «Перепідключити»." : (t.error_description || t.error || "Помилка Google"));
    throw new GoogleReconnectError("Доступ до Google закінчився. Налаштування → Google → Перепідключити.");
  }
  setSetting("google.error", "");
  g.__gtoken = { token: t.access_token, until: Date.now() + (t.expires_in - 60) * 1000 };
  return t.access_token;
}

async function api<T>(url: string, init: RequestInit = {}): Promise<T> {
  const token = await accessToken();
  const r = await fetch(url, { ...init, headers: { ...(init.headers ?? {}), authorization: `Bearer ${token}` } });
  if (r.status === 401) { g.__gtoken = undefined; throw new GoogleReconnectError("Google відхилив доступ — перепідключи."); }
  if (!r.ok) throw new Error(`Google ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return (await r.json()) as T;
}

// ---------- Диск ----------
const FOLDER_MIME = "application/vnd.google-apps.folder";
export const folderUrl = (id: string) => `https://drive.google.com/drive/folders/${id}`;

async function createFolder(name: string, parent?: string): Promise<string> {
  const f = await api<{ id: string }>("https://www.googleapis.com/drive/v3/files?fields=id", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, ...(parent ? { parents: [parent] } : {}) }),
  });
  return f.id;
}

export async function folderExists(id: string): Promise<boolean> {
  try {
    const f = await api<{ trashed: boolean }>(`https://www.googleapis.com/drive/v3/files/${id}?fields=trashed`);
    return !f.trashed;
  } catch (e) {
    if (e instanceof GoogleReconnectError) throw e;
    return false;
  }
}

export const folderIdFromUrl = (url: string) => url.match(/\/folders\/([\w-]+)/)?.[1] ?? null;
export const fileUrl = (id: string) => `https://drive.google.com/file/d/${id}/view`;

// Підпапка з назвою name у parent: знаходить існуючу або створює
export async function ensureSubfolder(parent: string, name: string): Promise<string> {
  const q = `'${parent}' in parents and name = '${name.replace(/'/g, "\\'")}' and mimeType = '${FOLDER_MIME}' and trashed = false`;
  const r = await api<{ files: { id: string }[] }>(`https://www.googleapis.com/drive/v3/files?fields=files(id)&q=${encodeURIComponent(q)}`);
  return r.files[0]?.id ?? createFolder(name, parent);
}

// Завантажити файл у папку (multipart: метадані + вміст), повертає id
export async function uploadFile(parent: string, name: string, data: Blob, mime: string): Promise<string> {
  const boundary = `co${Date.now().toString(36)}`;
  const body = new Blob([
    `--${boundary}\r\ncontent-type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name, parents: [parent] })}\r\n`,
    `--${boundary}\r\ncontent-type: ${mime || "application/octet-stream"}\r\n\r\n`,
    data,
    `\r\n--${boundary}--`,
  ]);
  const f = await api<{ id: string }>("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", {
    method: "POST",
    headers: { "content-type": `multipart/related; boundary=${boundary}` },
    body,
  });
  return f.id;
}

// Вміст файлу з Диску (тільки ті, що створила система — scope drive.file)
export async function downloadFile(id: string): Promise<Response> {
  const token = await accessToken();
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, { headers: { authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`Google ${r.status}`);
  return r;
}

// Головна папка «Client Ops» на Диску (створюється один раз)
export async function rootFolder(): Promise<string> {
  const saved = getSetting("google.root_folder");
  if (saved && (await folderExists(saved))) return saved;
  const id = await createFolder("Client Ops — клієнти");
  setSetting("google.root_folder", id);
  return id;
}

// Папка клієнта + підпапки. Повертає посилання.
export async function createClientFolders(name: string, kinds: readonly { kind: string; title: string }[]) {
  const root = await rootFolder();
  const main = await createFolder(name, root);
  const subs: { kind: string; title: string; url: string }[] = [];
  for (const k of kinds) subs.push({ kind: k.kind, title: k.title, url: folderUrl(await createFolder(k.title, main)) });
  return { mainUrl: folderUrl(main), subs };
}

// ---------- Gmail ----------
type GmailHeader = { name: string; value: string };
type GmailPart = { mimeType: string; body?: { data?: string }; parts?: GmailPart[]; headers?: GmailHeader[]; filename?: string };
type GmailMessage = { id: string; threadId: string; snippet: string; internalDate: string; labelIds?: string[]; payload: GmailPart & { headers: GmailHeader[] } };

export type MailItem = { id: string; threadId: string; from: string; to: string; subject: string; date: string; snippet: string; incoming: boolean };

const header = (m: GmailMessage, n: string) => m.payload.headers.find((h) => h.name.toLowerCase() === n.toLowerCase())?.value ?? "";
const b64 = (s: string) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");

function bodyText(p: GmailPart): string {
  if (p.mimeType === "text/plain" && p.body?.data) return b64(p.body.data);
  for (const c of p.parts ?? []) { const t = bodyText(c); if (t) return t; }
  if (p.mimeType === "text/html" && p.body?.data) return b64(p.body.data).replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/\n{3,}/g, "\n\n");
  return "";
}

// Листування з адресами клієнта (через кому) або за довільним пошуковим запитом Gmail
export function mailQuery(emails: string): string {
  const list = emails.split(/[,;\s]+/).map((e) => e.trim()).filter((e) => e.includes("@"));
  return list.length ? list.map((e) => `from:${e} OR to:${e}`).join(" OR ") : "";
}

export async function listMail(q: string, max = 20): Promise<MailItem[]> {
  if (!q) return [];
  const list = await api<{ messages?: { id: string }[] }>(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${max}&q=${encodeURIComponent(q)}`);
  const me = (getSetting("google.email") ?? "").toLowerCase();
  const out: MailItem[] = [];
  for (const { id } of list.messages ?? []) {
    const m = await api<GmailMessage>(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject`);
    const from = header(m, "From");
    out.push({ id: m.id, threadId: m.threadId, from, to: header(m, "To"), subject: header(m, "Subject") || "(без теми)", date: new Date(Number(m.internalDate)).toISOString(), snippet: m.snippet, incoming: !from.toLowerCase().includes(me) });
  }
  return out;
}

export async function readMail(id: string): Promise<MailItem & { body: string; messageId: string }> {
  const m = await api<GmailMessage>(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`);
  const me = (getSetting("google.email") ?? "").toLowerCase();
  const from = header(m, "From");
  return {
    id: m.id, threadId: m.threadId, from, to: header(m, "To"), subject: header(m, "Subject") || "(без теми)",
    date: new Date(Number(m.internalDate)).toISOString(), snippet: m.snippet, incoming: !from.toLowerCase().includes(me),
    body: bodyText(m.payload).trim().slice(0, 50_000), messageId: header(m, "Message-ID"),
  };
}

// Відправка листа (текст). Для відповіді — threadId і Message-ID листа, на який відповідаємо.
export async function sendMail(input: { to: string; subject: string; body: string; threadId?: string; inReplyTo?: string }): Promise<void> {
  const enc = (s: string) => `=?UTF-8?B?${Buffer.from(s, "utf8").toString("base64")}?=`;
  const lines = [
    `To: ${input.to}`,
    `Subject: ${enc(input.subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    ...(input.inReplyTo ? [`In-Reply-To: ${input.inReplyTo}`, `References: ${input.inReplyTo}`] : []),
    "",
    Buffer.from(input.body, "utf8").toString("base64"),
  ];
  const raw = Buffer.from(lines.join("\r\n")).toString("base64url");
  await api("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ raw, ...(input.threadId ? { threadId: input.threadId } : {}) }),
  });
}

// ---------- Календар ----------
// Доступ до календаря додали пізніше: хто підключав Google раніше — треба перепідключити (Налаштування → Конектори → Google)
export const calendarAllowed = () => googleConnected() && (getSetting("google.scopes") ?? "").includes(CALENDAR_SCOPE);
const CAL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

export type CalendarEvent = { summary: string; description: string; date: string; reminderMinutes?: number };

// Подія на весь день (дедлайн задачі) з нагадуванням. Повертає id події.
export async function calendarUpsert(ev: CalendarEvent, eventId?: string | null): Promise<string> {
  if (!googleConnected()) throw new GoogleReconnectError("Google не підключено");
  const end = new Date(`${ev.date}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  const body = JSON.stringify({
    summary: ev.summary,
    description: ev.description,
    start: { date: ev.date },
    end: { date: end.toISOString().slice(0, 10) },
    // для подій на весь день нагадування рахується від початку дня: 15 год до = 9:00 напередодні
    reminders: { useDefault: false, overrides: [{ method: "popup", minutes: ev.reminderMinutes ?? 15 * 60 }] },
  });
  try {
    const r = await api<{ id: string }>(eventId ? `${CAL}/${eventId}` : CAL, { method: eventId ? "PUT" : "POST", headers: { "content-type": "application/json" }, body });
    return r.id;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    // подію видалили в календарі вручну — створюємо заново
    if (eventId && /Google (404|410)/.test(msg)) return calendarUpsert(ev, null);
    if (/Google 403/.test(msg)) throw new GoogleReconnectError("Нема доступу до Календаря. Перепідключи Google (Налаштування → Конектори → Google) і перевір, що Google Calendar API увімкнений у Google Cloud.");
    throw e;
  }
}

export async function calendarDelete(eventId: string): Promise<void> {
  const token = await accessToken();
  await fetch(`${CAL}/${eventId}`, { method: "DELETE", headers: { authorization: `Bearer ${token}` } }).catch(() => {});
}

// ---------- Великі файли на Диск (бекап бази) ----------
// Resumable upload: спершу метадані → адреса сесії, потім байти одним PUT (працює і для файлів > 5 МБ)
export async function uploadBig(parent: string, name: string, data: Buffer, mime: string): Promise<string> {
  const token = await accessToken();
  const init = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json; charset=UTF-8", "x-upload-content-type": mime, "x-upload-content-length": String(data.length) },
    body: JSON.stringify({ name, parents: [parent] }),
  });
  const loc = init.headers.get("location");
  if (!init.ok || !loc) throw new Error(`Google ${init.status}: ${(await init.text()).slice(0, 200)}`);
  const put = await fetch(loc, { method: "PUT", headers: { "content-type": mime, "content-length": String(data.length) }, body: new Uint8Array(data), signal: AbortSignal.timeout(300_000) });
  if (!put.ok) throw new Error(`Google ${put.status}: ${(await put.text()).slice(0, 200)}`);
  return ((await put.json()) as { id: string }).id;
}

export async function listFolderFiles(folder: string): Promise<{ id: string; name: string; createdTime: string; size?: string }[]> {
  const q = encodeURIComponent(`'${folder}' in parents and trashed = false`);
  const r = await api<{ files: { id: string; name: string; createdTime: string; size?: string }[] }>(
    `https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=createdTime desc&pageSize=200&fields=files(id,name,createdTime,size)`);
  return r.files;
}

export async function deleteFile(id: string): Promise<void> {
  const token = await accessToken();
  await fetch(`https://www.googleapis.com/drive/v3/files/${id}`, { method: "DELETE", headers: { authorization: `Bearer ${token}` } });
}
