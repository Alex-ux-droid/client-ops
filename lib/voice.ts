// Голос помічника через ElevenLabs. Ключ — у .env (ELEVENLABS_API_KEY), голос і модель — у settings.
import { getSetting, setSetting } from "./repo/settings";
import { setEnvVar } from "./secrets";

const BASE = () => process.env.ELEVENLABS_BASE_URL || "https://api.elevenlabs.io";

export const VOICE_MODELS = [
  { id: "eleven_flash_v2_5", label: "Flash v2.5 — швидкий, вдвічі дешевший" },
  { id: "eleven_multilingual_v2", label: "Multilingual v2 — природніший, краще наголоси, вдвічі дорожчий" },
  { id: "eleven_v3", label: "v3 — найживіший, з емоціями (новіша, якщо не запрацює — повернись на v2)" },
] as const;

export function voiceKey(): string | null {
  return process.env.ELEVENLABS_API_KEY?.trim() || null;
}

export function voiceConfig() {
  return {
    configured: !!voiceKey(),
    voiceId: getSetting("voice.id") || "",
    voiceName: getSetting("voice.name") || "",
    model: getSetting("voice.model") || VOICE_MODELS[0].id,
  };
}

export function saveVoiceKey(key: string | null): void {
  setEnvVar("ELEVENLABS_API_KEY", key);
}

export function saveVoiceChoice(voiceId: string, voiceName: string, model: string): void {
  setSetting("voice.id", voiceId);
  setSetting("voice.name", voiceName);
  if (VOICE_MODELS.some((m) => m.id === model)) setSetting("voice.model", model);
}

export type Voice = { voice_id: string; name: string; labels?: Record<string, string> };

export async function listVoices(): Promise<Voice[]> {
  const key = voiceKey();
  if (!key) return [];
  const r = await fetch(`${BASE()}/v1/voices`, { headers: { "xi-api-key": key }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`ElevenLabs ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return ((await r.json()) as { voices?: Voice[] }).voices ?? [];
}

// Помилка ElevenLabs → зрозумілий текст з їхнім оригінальним поясненням (щоб було видно справжню причину).
// 429 буває і без кінця кредитів: «забагато одночасних запитів» / «система зайнята» — такі повторюємо.
type ElErr = { retry: boolean; error: Error };
function elevenError(status: number, body: string): ElErr {
  let code = "", msg = body.slice(0, 300);
  try {
    const j = JSON.parse(body) as { detail?: { status?: string; code?: string; message?: string } | string };
    if (typeof j.detail === "string") msg = j.detail;
    else if (j.detail) { code = j.detail.status || j.detail.code || ""; msg = j.detail.message || msg; }
  } catch {}
  const raw = `${status}${code ? ` ${code}` : ""}: ${msg}`;
  if (/quota|credit|exceeds your/i.test(`${code} ${msg}`))
    return { retry: false, error: new Error(`ElevenLabs не пустив через ліміт кредитів (${raw}). Якщо в кабінеті кредити є — перевір ліміт на самому ключі API: Developers → API Keys → ключ → Credit limit`) };
  if (status === 401 || /invalid_api_key|unauthorized/i.test(code)) return { retry: false, error: new Error(`Ключ ElevenLabs не підходить або не має дозволу на цю функцію (${raw})`) };
  if (status === 429 || status >= 500 || /concurrent|busy|rate/i.test(code)) return { retry: true, error: new Error(`ElevenLabs зараз перевантажений, спробуй ще раз (${raw})`) };
  return { retry: false, error: new Error(`ElevenLabs ${raw}`) };
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Текст → mp3. Помилки ElevenLabs (ліміт, ключ) віддаємо зрозумілим текстом.
export async function synthesize(text: string): Promise<ArrayBuffer> {
  const key = voiceKey();
  const cfg = voiceConfig();
  if (!key || !cfg.voiceId) throw new Error("ElevenLabs не налаштовано");
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(`${BASE()}/v1/text-to-speech/${encodeURIComponent(cfg.voiceId)}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": key, "content-type": "application/json", accept: "audio/mpeg" },
      body: JSON.stringify({ text, model_id: cfg.model }),
      signal: AbortSignal.timeout(30000),
    });
    if (r.ok) return r.arrayBuffer();
    const e = elevenError(r.status, await r.text());
    if (!e.retry || attempt >= 2) throw e.error;
    await wait(1500 * (attempt + 1));
  }
}

// Розпізнавання голосу (ElevenLabs Scribe). Нова модель першою; якщо її id не приймуть — пробуємо попередню.
const STT_MODELS = ["scribe_v2", "scribe_v1"];

export async function transcribe(audio: Blob, filename: string): Promise<string> {
  const key = voiceKey();
  if (!key) throw new Error("ElevenLabs не налаштовано");
  let last = "";
  for (const model of STT_MODELS) {
    const fd = new FormData();
    fd.append("file", audio, filename);
    fd.append("model_id", model);
    fd.append("language_code", "uk");
    fd.append("tag_audio_events", "false");
    let r: Response | null = null, body = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      r = await fetch(`${BASE()}/v1/speech-to-text`, { method: "POST", headers: { "xi-api-key": key }, body: fd, signal: AbortSignal.timeout(90000) });
      if (r.ok) return String(((await r.json()) as { text?: string }).text ?? "").trim();
      body = await r.text();
      const e = elevenError(r.status, body);
      if (/model/i.test(body) && !/quota|credit/i.test(body)) break; // id моделі не прийняли — пробуємо наступну
      if (!e.retry || attempt === 2) throw e.error;
      await wait(1500 * (attempt + 1));
    }
    last = body.slice(0, 300);
  }
  throw new Error(`Розпізнавання не вдалось: ${last}`);
}

// Одноразовий токен для живого розпізнавання (Scribe v2 Realtime): браузер підключається до ElevenLabs напряму,
// постійний ключ лишається на сервері. Токен живе 15 хв і згорає при підключенні.
export async function liveSttToken(): Promise<string> {
  const key = voiceKey();
  if (!key) throw new Error("ElevenLabs не підключено");
  const r = await fetch(`${BASE()}/v1/single-use-token/realtime_scribe`, { method: "POST", headers: { "xi-api-key": key }, signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(`ElevenLabs ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return ((await r.json()) as { token: string }).token;
}
