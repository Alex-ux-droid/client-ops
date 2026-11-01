"use client";
import { useLayoutEffect, useRef, useState } from "react";

// Поки диктуєш: поверх поля — те, що вже було (звичайним кольором) + почуте сірим. На «стоп» текст іде в поле білим.
// Поле під накладкою на цей час «прозоре» (клас vt-ghost), стиль накладки копіюється з поля.
export default function DictOverlay({ el, base, heard, fixing }: { el: HTMLTextAreaElement | null; base: string; heard: string; fixing: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});
  useLayoutEffect(() => {
    if (!el) return;
    const cs = getComputedStyle(el);
    setStyle({
      top: el.offsetTop, left: el.offsetLeft, width: el.offsetWidth, height: el.offsetHeight,
      font: cs.font, lineHeight: cs.lineHeight, letterSpacing: cs.letterSpacing,
      padding: cs.padding, borderWidth: cs.borderWidth, borderStyle: "solid", borderColor: "transparent", borderRadius: cs.borderRadius, textAlign: cs.textAlign as React.CSSProperties["textAlign"],
    });
    el.classList.add("vt-ghost");
    return () => el.classList.remove("vt-ghost");
  }, [el]);
  useLayoutEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [heard, base]);
  return (
    <div ref={ref} className="dict-ov" style={style} aria-live="polite">
      {base}{base && !/\s$/.test(base) ? " " : ""}<span className="dict-heard">{heard || "Слухаю…"}</span>{fixing && <span className="dict-fixing"> · причісую…</span>}
    </div>
  );
}
