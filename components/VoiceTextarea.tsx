"use client";
import { useRef } from "react";
import Icon from "./Icon";
import { useDictation } from "./useDictation";

// Поле тексту з мікрофоном: натиснув — говориш, ще раз — текст дописується в поле.
// Заміна звичайного <textarea> у формах (працює і з defaultValue, і з ref).
export default function VoiceTextarea({ ref, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: React.Ref<HTMLTextAreaElement> }) {
  const el = useRef<HTMLTextAreaElement | null>(null);
  const base = useRef<string | null>(null); // що було в полі до початку диктування
  // Пишемо в поле: те, що було, + почуте (живий текст замінюється остаточним)
  const put = (heard: string, final: boolean) => {
    const t = el.current;
    if (!t) return;
    const b = base.current ?? t.value;
    const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set; // щоб React бачив зміну
    set?.call(t, heard ? (b && !/\s$/.test(b) ? `${b} ${heard}` : b + heard) : b);
    t.dispatchEvent(new Event("input", { bubbles: true }));
    t.scrollTop = t.scrollHeight;
    if (final) { base.current = null; t.focus(); }
  };
  const dict = useDictation((text) => put(text, true), (text) => { if (base.current === null) base.current = el.current?.value ?? ""; put(text, false); });
  const setRef = (node: HTMLTextAreaElement | null) => {
    el.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) (ref as React.RefObject<HTMLTextAreaElement | null>).current = node;
  };
  return (
    <div className="vt">
      <textarea ref={setRef} {...props} />
      {dict.supported && (
        <button type="button" className={`vt-mic ${dict.listening ? "on" : ""}`} onClick={dict.toggle} disabled={dict.transcribing}
          title={dict.listening ? "Стоп — текст піде в поле" : "Надиктувати"} aria-label="Надиктувати">
          {dict.transcribing ? <span className="mic-wait" /> : dict.listening ? <span className="mic-stop" /> : <Icon name="mic" size={18} />}
        </button>
      )}
      {dict.error && <div className="vt-err">{dict.error}</div>}
    </div>
  );
}
