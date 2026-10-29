"use client";
// Голос помічника: вбудований синтез мови браузера/телефона (безкоштовно). Вмикається кнопкою, вибір запам'ятовується.
import { useCallback, useEffect, useState } from "react";

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

  useEffect(() => {
    if (!("speechSynthesis" in window)) { setSupported(false); return; }
    try { setEnabled(localStorage.getItem(KEY) === "1"); } catch {}
    const check = () => setHasUk(!!ukVoice());
    check();
    window.speechSynthesis.addEventListener?.("voiceschanged", check);
    return () => window.speechSynthesis.removeEventListener?.("voiceschanged", check);
  }, []);

  const speak = useCallback((text: string) => {
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
  }, [onSpeaking]);

  const stopSpeaking = useCallback(() => { window.speechSynthesis?.cancel(); onSpeaking?.(false); }, [onSpeaking]);

  // Вмикання — з натискання: на iPhone звук дозволено тільки після дії користувача
  const toggle = useCallback(() => {
    const next = !enabled;
    setEnabled(next);
    try { localStorage.setItem(KEY, next ? "1" : "0"); } catch {}
    if (next) speak("Голос увімкнено");
    else stopSpeaking();
  }, [enabled, speak, stopSpeaking]);

  return { enabled, supported, hasUk, toggle, speak, stopSpeaking };
}
