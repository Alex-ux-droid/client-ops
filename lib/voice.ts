// Голос помічника через ElevenLabs. Ключ — у .env (ELEVENLABS_API_KEY), голос і модель — у settings.
import { getSetting, setSetting } from "./repo/settings";
import { setEnvVar } from "./secrets";

const BASE = () => process.env.ELEVENLABS_BASE_URL || "https://api.elevenlabs.io";

export const VOICE_MODELS = [
  { id: "eleven_flash_v2_5", label: "Flash v2.5 — швидкий, вдвічі дешевший" },
  { id: "eleven_multilingual_v2", label: "Multilingual v2 — найприродніший, дорожчий" },
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

// Текст → mp3. Помилки ElevenLabs (ліміт, ключ) віддаємо зрозумілим текстом.
export async function synthesize(text: string): Promise<ArrayBuffer> {
  const key = voiceKey();
  const cfg = voiceConfig();
  if (!key || !cfg.voiceId) throw new Error("ElevenLabs не налаштовано");
  const r = await fetch(`${BASE()}/v1/text-to-speech/${encodeURIComponent(cfg.voiceId)}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": key, "content-type": "application/json", accept: "audio/mpeg" },
    body: JSON.stringify({ text, model_id: cfg.model }),
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) {
    const msg = (await r.text()).slice(0, 300);
    if (r.status === 401) throw new Error("Ключ ElevenLabs не підходить");
    if (r.status === 429 || /quota/i.test(msg)) throw new Error("Закінчились кредити ElevenLabs на цей місяць");
    throw new Error(`ElevenLabs ${r.status}: ${msg}`);
  }
  return r.arrayBuffer();
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
    const r = await fetch(`${BASE()}/v1/speech-to-text`, { method: "POST", headers: { "xi-api-key": key }, body: fd, signal: AbortSignal.timeout(90000) });
    if (r.ok) return String(((await r.json()) as { text?: string }).text ?? "").trim();
    last = (await r.text()).slice(0, 300);
    if (r.status === 401) throw new Error("Ключ ElevenLabs не підходить");
    if (r.status === 429 || /quota/i.test(last)) throw new Error("Закінчились кредити ElevenLabs");
    if (!/model/i.test(last)) break; // помилка не про модель — далі пробувати нема сенсу
  }
  throw new Error(`Розпізнавання не вдалось: ${last}`);
}
