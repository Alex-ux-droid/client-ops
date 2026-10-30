"use client";
// «Затисни і говори»: коротке натискання — відкрити чат; затиснув — пишемо голос, відпустив — текст іде Джері.
import { useCallback, useEffect, useRef, useState } from "react";
import { openAssistant } from "./assistant";
import { useDictation } from "./useDictation";

const HOLD_MS = 350;

export function useHoldToTalk(openChat: () => void) {
  const dict = useDictation((text) => { if (text.trim()) openAssistant(text.trim(), true); });
  const downAt = useRef(0);
  const pressed = useRef(false);
  const [hint, setHint] = useState("");

  // Помилку показуємо кілька секунд біля робота
  useEffect(() => {
    if (!dict.error) return;
    setHint(dict.error);
    const t = setTimeout(() => { setHint(""); dict.clearError(); }, 3500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dict.error]);

  const release = useCallback(() => {
    if (!pressed.current) return;
    pressed.current = false;
    if (Date.now() - downAt.current < HOLD_MS) { dict.cancel(); openChat(); }
    else dict.stop();
  }, [dict, openChat]);

  const bind = {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0 || dict.transcribing) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId); // палець зʼїхав з кнопки — запис не обривається
      pressed.current = true;
      downAt.current = Date.now();
      setHint("");
      dict.start(); // одразу, поки триває жест — інакше iPhone не дасть мікрофон
    },
    onPointerUp: release,
    onPointerCancel: release,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openChat(); } },
  };

  const state = dict.listening ? "listening" : dict.transcribing ? "thinking" : "idle";
  const label = dict.listening ? "Слухаю… відпусти — надішлю Джері" : dict.transcribing ? "Розпізнаю…" : hint;
  return { bind, state: state as "idle" | "listening" | "thinking", label };
}
