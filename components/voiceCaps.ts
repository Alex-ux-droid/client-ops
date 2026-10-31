"use client";
// Що вміє сервер: голос ElevenLabs (eleven) і платне розпізнавання (stt). Питаємо один раз.
let caps: Promise<{ eleven: boolean; stt: boolean; live: boolean }> | null = null;
export function voiceCaps() {
  caps ??= fetch("/api/tts").then((r) => r.json()).then((d) => ({ eleven: !!d.eleven, stt: !!d.stt, live: !!d.live })).catch(() => ({ eleven: false, stt: false, live: false }));
  return caps;
}
