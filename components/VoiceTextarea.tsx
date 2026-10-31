"use client";
import { useRef } from "react";
import Icon from "./Icon";
import { useDictation } from "./useDictation";

// Поле тексту з мікрофоном: натиснув — говориш, ще раз — текст дописується в поле.
// Заміна звичайного <textarea> у формах (працює і з defaultValue, і з ref).
export default function VoiceTextarea({ ref, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: React.Ref<HTMLTextAreaElement> }) {
  const el = useRef<HTMLTextAreaElement | null>(null);
  const dict = useDictation((chunk) => {
    const t = el.current;
    if (!t) return;
    const v = t.value;
    // через нативний setter, щоб React (якщо поле кероване) побачив зміну
    const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    set?.call(t, v && !/\s$/.test(v) ? `${v} ${chunk}` : v + chunk);
    t.dispatchEvent(new Event("input", { bubbles: true }));
    t.focus();
  });
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
