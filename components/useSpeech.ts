"use client";
// Голос помічника: ElevenLabs (якщо підключено в Налаштуваннях) або вбудований голос телефона.
// Вмикається кнопкою, вибір запам'ятовується.
import { useCallback, useEffect, useRef, useState } from "react";
import { voiceCaps } from "./voiceCaps";

// Тиша (WAV) — щоб «розблокувати» звук на iPhone під час натискання; потім цей самий плеєр грає відповідь
function silentWav(): string {
  const n = 800, buf = new ArrayBuffer(44 + n), v = new DataView(buf);
  const w = (o: number, t: string) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF"); v.setUint32(4, 36 + n, true); w(8, "WAVE"); w(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, 1, true); v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  w(36, "data"); v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
  let bin = ""; new Uint8Array(buf).forEach((b) => (bin += String.fromCharCode(b)));
  return `data:audio/wav;base64,${btoa(bin)}`;
}
let player: HTMLAudioElement | null = null;
const getPlayer = () => (player ??= new Audio());

const KEY = "co:voice";

function ukVoice(): SpeechSynthesisVoice | undefined {
  const vs = window.speechSynthesis?.getVoices() ?? [];
  return vs.find((v) => v.lang?.toLowerCase().startsWith("uk")) ?? undefined;
}

// Прибираємо те, що звучить погано: markdown, посилання, id
const clean = (t: string) => t
  .replace(/https?:\/\/\S+/g, "посилання")
  .replace(/[#*_`>|]/g, "")
  .replace(/\(?\b\w+_id \d+\)?/g, "")
  .replace(/\s+/g, " ")
  .trim();

export function useSpeech(onSpeaking?: (on: boolean) => void) {
  const [enabled, setEnabled] = useState(false);
  const [supported, setSupported] = useState(true);
  const [hasUk, setHasUk] = useState(true);
  const [eleven, setEleven] = useState(false);
  const [error, setError] = useState("");
  const url = useRef("");

  useEffect(() => {
    try { setEnabled(localStorage.getItem(KEY) === "1"); } catch {}
    voiceCaps().then((c) => setEleven(c.eleven));
    if (!("speechSynthesis" in window)) { setSupported(false); return; }
    const check = () => setHasUk(!!ukVoice());
    check();
    window.speechSynthesis.addEventListener?.("voiceschanged", check);
    return () => window.speechSynthesis.removeEventListener?.("voiceschanged", check);
  }, []);

  // Викликати в обробнику натискання (Надіслати / мікрофон), щоб iPhone дозволив звук пізніше
  const prime = useCallback(() => {
    if (!eleven) return;
    const p = getPlayer();
    if (!p.src) { p.src = silentWav(); p.play().catch(() => {}); }
  }, [eleven]);

  const speakEleven = useCallback(async (text: string) => {
    setError("");
    try {
      const r = await fetch("/api/tts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: clean(text) }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Голос не вийшов");
      const blob = await r.blob();
      if (url.current) URL.revokeObjectURL(url.current);
      url.current = URL.createObjectURL(blob);
      const p = getPlayer();
      p.src = url.current;
      p.onplay = () => onSpeaking?.(true);
      p.onended = p.onpause = p.onerror = () => onSpeaking?.(false);
      await p.play();
    } catch (e) {
      onSpeaking?.(false);
      setError(e instanceof Error ? e.message : "Голос не вийшов");
    }
  }, [onSpeaking]);

  const speak = useCallback((text: string) => {
    if (eleven) { void speakEleven(text); return; }
    const s = window.speechSynthesis;
    if (!s) return;
    s.cancel();
    const u = new SpeechSynthesisUtterance(clean(text).slice(0, 1500));
    u.lang = "uk-UA";
    const v = ukVoice();
    if (v) u.voice = v;
    u.rate = 1.05;
    u.onstart = () => onSpeaking?.(true);
    u.onend = u.onerror = () => onSpeaking?.(false);
    s.speak(u);
  }, [onSpeaking, eleven, speakEleven]);

  const stopSpeaking = useCallback(() => { window.speechSynthesis?.cancel(); player?.pause(); onSpeaking?.(false); }, [onSpeaking]);

  // Вмикання — з натискання: на iPhone звук дозволено тільки після дії користувача
  const toggle = useCallback(() => {
    const next = !enabled;
    setEnabled(next);
    try { localStorage.setItem(KEY, next ? "1" : "0"); } catch {}
    if (next) { prime(); speak("Голос увімкнено"); }
    else stopSpeaking();
  }, [enabled, speak, stopSpeaking, prime]);

  return { enabled, supported: supported || eleven, hasUk: hasUk || eleven, eleven, error, toggle, speak, stopSpeaking, prime };
}
