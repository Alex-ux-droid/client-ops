"use client";
// Диктування голосом через вбудоване в браузер розпізнавання мови (Chrome, Edge, Safari).
import { useCallback, useEffect, useRef, useState } from "react";

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

export function useDictation(onText: (chunk: string) => void) {
  const rec = useRef<Rec | null>(null);
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const [error, setError] = useState("");
  const cb = useRef(onText);
  cb.current = onText;

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
    setSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
    return () => { rec.current?.stop(); };
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
    };
    r.onerror = (e) => { if (e.error !== "aborted" && e.error !== "no-speech") setError(ERRORS[e.error] ?? `Помилка розпізнавання: ${e.error}`); };
    r.onend = () => { if (sess.current === x) setListening(false); flush(x); };
    setError("");
    sess.current = x;
    rec.current = r;
    try { r.start(); setListening(true); } catch { setError("Мікрофон зайнятий — спробуй ще раз."); }
  }, [flush]);

  const toggle = useCallback(() => (listening ? stop() : start()), [listening, start, stop]);
  return { listening, supported, error, toggle, stop };
}
