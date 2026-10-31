"use client";
// Живе розпізнавання ElevenLabs (Scribe v2 Realtime) напряму з браузера: мікрофон → AudioWorklet → PCM 16 кГц
// шматками по 100 мс → WebSocket; у відповідь — проміжний (partial) і остаточний (committed) текст.
// Формат узято з робочої реалізації (документація ElevenLabs з хмарної сесії недоступна). Якщо щось не так —
// повертає null, і диктування працює по-старому (запис → розпізнавання після «стоп»).

const RATE = 16000;
const WORKLET = `
class Pcm16 extends AudioWorkletProcessor {
  constructor() { super(); this.ratio = sampleRate / ${RATE}; this.phase = 0; this.sum = 0; this.count = 0; this.out = new Int16Array(1600); this.len = 0; }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) {
      this.sum += ch[i]; this.count++; this.phase++;
      if (this.phase < this.ratio) continue;
      this.phase -= this.ratio;
      const s = Math.max(-1, Math.min(1, this.sum / this.count));
      this.out[this.len++] = s < 0 ? s * 0x8000 : s * 0x7fff;
      this.sum = 0; this.count = 0;
      if (this.len === this.out.length) { this.port.postMessage(this.out.buffer, [this.out.buffer]); this.out = new Int16Array(1600); this.len = 0; }
    }
    return true;
  }
}
registerProcessor("pcm16-co", Pcm16);`;

const b64 = (buf: ArrayBuffer) => {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

export type Live = { stop: () => Promise<string> };

export async function startLive(ctx: AudioContext, stream: MediaStream, onText: (text: string) => void): Promise<Live | null> {
  let ws: WebSocket | null = null, node: AudioWorkletNode | null = null, src: MediaStreamAudioSourceNode | null = null, mute: GainNode | null = null;
  let finalized = "", interim = "";
  let onCommit: (() => void) | null = null;
  const text = () => `${finalized} ${interim}`.replace(/\s+/g, " ").trim();
  const cleanup = () => {
    try { node?.disconnect(); src?.disconnect(); mute?.disconnect(); } catch {}
    if (ws && ws.readyState <= 1) { ws.onclose = null; ws.close(); }
    void ctx.close().catch(() => {});
  };
  try {
    const r = await fetch("/api/stt/live", { method: "POST" });
    if (!r.ok) throw new Error("token");
    const { token } = (await r.json()) as { token: string };
    const url = new URL("wss://api.elevenlabs.io/v1/speech-to-text/realtime");
    url.searchParams.set("model_id", "scribe_v2_realtime");
    url.searchParams.set("language_code", "ukr");
    url.searchParams.set("audio_format", `pcm_${RATE}`);
    url.searchParams.set("commit_strategy", "vad");
    url.searchParams.set("token", token);
    const socket = new WebSocket(url);
    ws = socket;
    // чекаємо session_started (або помилку) не довше 6 с
    await new Promise<void>((ok, bad) => {
      const t = setTimeout(() => bad(new Error("timeout")), 6000);
      socket.onmessage = (ev) => {
        let m: { message_type?: string; text?: string };
        try { m = JSON.parse(String(ev.data)); } catch { return; }
        const type = m.message_type ?? "";
        if (type === "session_started") { clearTimeout(t); ok(); return; }
        if (type === "partial_transcript") { interim = m.text ?? ""; onText(text()); return; }
        if (type === "committed_transcript" || type === "committed_transcript_with_timestamps") {
          if (m.text) finalized = `${finalized} ${m.text}`.trim();
          interim = "";
          onText(text());
          onCommit?.();
          return;
        }
        if (type.endsWith("error") || ["quota_exceeded", "rate_limited", "invalid_request", "session_time_limit_exceeded"].includes(type)) {
          clearTimeout(t); bad(new Error(type));
        }
      };
      socket.onerror = () => { clearTimeout(t); bad(new Error("socket")); };
      socket.onclose = () => { clearTimeout(t); bad(new Error("closed")); };
    });
    const blobUrl = URL.createObjectURL(new Blob([WORKLET], { type: "application/javascript" }));
    await ctx.audioWorklet.addModule(blobUrl);
    URL.revokeObjectURL(blobUrl);
    await ctx.resume();
    src = ctx.createMediaStreamSource(stream);
    node = new AudioWorkletNode(ctx, "pcm16-co");
    mute = ctx.createGain();
    mute.gain.value = 0;
    node.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
      if (socket.readyState === 1) socket.send(JSON.stringify({ message_type: "input_audio_chunk", audio_base_64: b64(e.data), commit: false, sample_rate: RATE }));
    };
    src.connect(node);
    node.connect(mute);
    mute.connect(ctx.destination);
  } catch {
    cleanup();
    return null;
  }
  return {
    // Стоп: просимо дозафіксувати останній шматок і чекаємо до 1,5 с; що не встигло — беремо з проміжного
    stop: async () => {
      try { node?.disconnect(); } catch {}
      if (ws?.readyState === 1 && interim) {
        await new Promise<void>((done) => {
          const t = setTimeout(done, 1500);
          onCommit = () => { clearTimeout(t); done(); };
          try { ws!.send(JSON.stringify({ message_type: "input_audio_chunk", audio_base_64: "", commit: true, sample_rate: RATE })); } catch { clearTimeout(t); done(); }
        });
      }
      const result = text();
      cleanup();
      return result;
    },
  };
}
