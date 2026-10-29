"use client";
// Диктування голосом через вбудоване в браузер розпізнавання мови (Chrome, Edge, Safari).
import { useCallback, useEffect, useRef, useState } from "react";

type Rec = {
  lang: string; continuous: boolean; interimResults: boolean;
  start(): void; stop(): void;
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

  // Текст збираємо весь і віддаємо на «стоп»: Safari на iPhone часто не позначає результат як остаточний.
  const heard = useRef("");
  const flushed = useRef(true);
  const flush = useCallback(() => {
    if (flushed.current) return;
    flushed.current = true;
    const text = heard.current.trim();
    if (text) cb.current(text);
    else setError(ERRORS["no-speech"]);
  }, []);

  const stop = useCallback(() => {
    rec.current?.stop();
    setTimeout(flush, 1500); // якщо onend так і не прийде
  }, [flush]);

  const start = useCallback(() => {
    const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) { setError("Цей браузер не вміє диктувати. Натисни мікрофон на клавіатурі телефона."); return; }
    const r = new Ctor();
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
      heard.current = acc;
    };
    r.onerror = (e) => { if (e.error !== "aborted" && e.error !== "no-speech") setError(ERRORS[e.error] ?? `Помилка розпізнавання: ${e.error}`); };
    r.onend = () => { setListening(false); flush(); };
    setError("");
    heard.current = "";
    flushed.current = false;
    rec.current = r;
    r.start();
    setListening(true);
  }, [flush]);

  const toggle = useCallback(() => (listening ? stop() : start()), [listening, start, stop]);
  return { listening, supported, error, toggle, stop };
}
