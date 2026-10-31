"use client";
// Диктування голосом через вбудоване в браузер розпізнавання мови (Chrome, Edge, Safari).
import { useCallback, useEffect, useRef, useState } from "react";
import { startLive, type Live } from "./liveStt";
import { voiceCaps } from "./voiceCaps";

type Rec = {
  lang: string; continuous: boolean; interimResults: boolean;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

const ERRORS: Record<string, string> = {
  "not-allowed": "Нема доступу до мікрофона — дозволь його в браузері.",
  "service-not-allowed": "Браузер не дозволив розпізнавання мови.",
  "no-speech": "Нічого не почув — спробуй ще раз.",
  network: "Розпізнаванню потрібен інтернет.",
};

// onText — остаточний текст сесії (на «стоп»); onLive — що чути зараз, поки говориш (вся сесія, оновлюється)
export function useDictation(onText: (chunk: string) => void, onLive?: (text: string) => void) {
  const rec = useRef<Rec | null>(null);
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const [error, setError] = useState("");
  const [transcribing, setTranscribing] = useState(false);
  const [paid, setPaid] = useState(false); // є ElevenLabs → пишемо аудіо і розпізнаємо на сервері
  const recorder = useRef<MediaRecorder | null>(null);
  const discard = useRef(false);   // «затисни і говори»: короткий тап — запис викидаємо
  const aborted = useRef(false);   // відпустили ще до того, як мікрофон увімкнувся
  const cb = useRef(onText);
  cb.current = onText;
  const liveCb = useRef(onLive);
  liveCb.current = onLive;
  const [liveOn, setLiveOn] = useState(false); // ElevenLabs Realtime: текст видно, поки говориш
  const live = useRef<Promise<Live | null> | null>(null);

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
    setSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition) || typeof MediaRecorder !== "undefined");
    voiceCaps().then((c) => {
      setPaid(c.stt && typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia);
      setLiveOn(c.live && typeof AudioWorkletNode !== "undefined" && typeof WebSocket !== "undefined");
    });
    return () => { rec.current?.stop(); recorder.current?.stream.getTracks().forEach((t) => t.stop()); };
  }, []);

  // Кожне натискання — окрема сесія зі своїм текстом. Текст віддаємо на «стоп»:
  // Safari на iPhone часто не позначає результат як остаточний і інколи не надсилає onend.
  type Sess = { r: Rec; heard: string; done: boolean };
  const sess = useRef<Sess | null>(null);
  const flush = useCallback((x: Sess) => {
    if (x.done) return;
    x.done = true;
    const text = x.heard.trim();
    if (text) cb.current(text);
    else setError(ERRORS["no-speech"]);
  }, []);

  const stop = useCallback(() => {
    const x = sess.current;
    setListening(false); // одразу, не чекаючи onend — інакше наступне натискання знову «зупиняє»
    if (!x) return;
    try { x.r.stop(); } catch {}
    setTimeout(() => { flush(x); try { x.r.abort(); } catch {} }, 1200);
  }, [flush]);

  const start = useCallback(() => {
    const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) { setError("Цей браузер не вміє диктувати. Натисни мікрофон на клавіатурі телефона."); return; }
    // Попередня сесія ще висить — віддаємо, що встигла почути, і глушимо
    const prev = sess.current;
    if (prev && !prev.done) { flush(prev); try { prev.r.abort(); } catch {} }
    window.speechSynthesis?.cancel(); // помічник замовкає, коли Саша говорить
    const r = new Ctor();
    const x: Sess = { r, heard: "", done: false };
    r.lang = "uk-UA";
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      // iPhone інколи повторює попередній шматок у наступному — склеюємо без дублів
      let acc = "";
      for (const res of Array.from(e.results)) {
        const t = res[0].transcript.trim();
        if (!t) continue;
        if (t.toLowerCase().startsWith(acc.toLowerCase())) acc = t;
        else if (!acc.toLowerCase().endsWith(t.toLowerCase())) acc = `${acc} ${t}`;
      }
      x.heard = acc;
      liveCb.current?.(acc);
    };
    r.onerror = (e) => { if (e.error !== "aborted" && e.error !== "no-speech") setError(ERRORS[e.error] ?? `Помилка розпізнавання: ${e.error}`); };
    r.onend = () => { if (sess.current === x) setListening(false); flush(x); };
    setError("");
    sess.current = x;
    rec.current = r;
    try { r.start(); setListening(true); } catch { setError("Мікрофон зайнятий — спробуй ще раз."); }
  }, [flush]);

  // Платне розпізнавання: записуємо звук, на «стоп» відправляємо на сервер
  const startRec = useCallback(async () => {
    // AudioContext — синхронно в межах натискання, інакше Safari лишить його «заснулим»
    let ctx: AudioContext | null = null;
    if (liveOn && liveCb.current) { try { ctx = new AudioContext(); } catch { ctx = null; } }
    live.current = null;
    window.speechSynthesis?.cancel();
    setError("");
    discard.current = false;
    aborted.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      if (aborted.current) { stream.getTracks().forEach((t) => t.stop()); void ctx?.close(); return; }
      const type = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg"].find((t) => MediaRecorder.isTypeSupported?.(t));
      const mr = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      const chunks: Blob[] = [];
      mr.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      mr.onstop = async () => {
        // живий текст: дочекатись останнього шматка і взяти його; не вийшло — розпізнаємо запис, як раніше
        const lv = live.current ? await live.current : null;
        const liveText = lv ? await lv.stop() : "";
        stream.getTracks().forEach((t) => t.stop());
        if (discard.current) return;
        if (liveText) { cb.current(liveText); return; }
        const blob = new Blob(chunks, { type: mr.mimeType || type || "audio/webm" });
        if (blob.size < 2000) { setError(ERRORS["no-speech"]); return; }
        setTranscribing(true);
        try {
          const fd = new FormData();
          fd.append("audio", blob, "voice");
          const r = await fetch("/api/stt", { method: "POST", body: fd });
          const d = await r.json();
          if (!r.ok) throw new Error(d.error || "Не розпізнав");
          if (d.text) cb.current(d.text); else setError(ERRORS["no-speech"]);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Не розпізнав");
        } finally {
          setTranscribing(false);
        }
      };
      recorder.current = mr;
      mr.start(1000);
      setListening(true);
      if (ctx) live.current = startLive(ctx, stream, (t) => liveCb.current?.(t));
    } catch {
      setError(ERRORS["not-allowed"]);
    }
  }, [liveOn]);

  const stopRec = useCallback(() => {
    setListening(false);
    const mr = recorder.current;
    if (mr && mr.state !== "inactive") mr.stop();
    else aborted.current = true;
  }, []);

  const toggle = useCallback(() => {
    if (transcribing) return;
    if (paid) return listening ? stopRec() : void startRec();
    return listening ? stop() : start();
  }, [paid, listening, transcribing, start, stop, startRec, stopRec]);
  const stopAny = useCallback(() => (paid ? stopRec() : stop()), [paid, stop, stopRec]);
  const startAny = useCallback(() => { if (!transcribing) { if (paid) void startRec(); else start(); } }, [paid, transcribing, start, startRec]);
  // Скасувати без тексту (короткий тап замість затискання)
  const cancel = useCallback(() => {
    discard.current = true;
    const x = sess.current;
    if (x) x.done = true;
    if (paid) stopRec();
    else { setListening(false); try { x?.r.abort(); } catch {} }
  }, [paid, stopRec]);
  return { listening, transcribing, supported, error, toggle, stop: stopAny, start: startAny, cancel, clearError: () => setError("") };
}
