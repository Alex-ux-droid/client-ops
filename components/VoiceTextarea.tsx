"use client";
import { useRef, useState } from "react";
import DictOverlay from "./DictOverlay";
import Icon from "./Icon";
import { useDictation } from "./useDictation";

// Поле тексту з мікрофоном: натиснув — говориш (почуте видно сірим поверх поля), ще раз — текст причісується і дописується в поле.
// Заміна звичайного <textarea> у формах (працює і з defaultValue, і з ref).
export default function VoiceTextarea({ ref, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: React.Ref<HTMLTextAreaElement> }) {
  const el = useRef<HTMLTextAreaElement | null>(null);
  const [heard, setHeard] = useState("");
  const put = (text: string) => {
    const t = el.current;
    setHeard("");
    if (!t) return;
    const b = t.value;
    const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set; // щоб React бачив зміну
    set?.call(t, text ? (b && !/\s$/.test(b) ? `${b} ${text}` : b + text) : b);
    t.dispatchEvent(new Event("input", { bubbles: true }));
    t.scrollTop = t.scrollHeight;
    t.focus();
  };
  const dict = useDictation(put, setHeard);
  const setRef = (node: HTMLTextAreaElement | null) => {
    el.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) (ref as React.RefObject<HTMLTextAreaElement | null>).current = node;
  };
  const active = dict.listening || dict.fixing;
  return (
    <div className="vt">
      <textarea ref={setRef} {...props} />
      {active && <DictOverlay el={el.current} base={el.current?.value ?? ""} heard={heard} fixing={dict.fixing} />}
      {dict.supported && (
        <button type="button" className={`vt-mic ${dict.listening ? "on" : ""}`} onClick={dict.toggle} disabled={dict.transcribing || dict.fixing}
          title={dict.listening ? "Стоп — текст піде в поле" : "Надиктувати"} aria-label="Надиктувати">
          {dict.transcribing || dict.fixing ? <span className="mic-wait" /> : dict.listening ? <span className="mic-stop" /> : <Icon name="mic" size={18} />}
        </button>
      )}
      {dict.error && <div className="vt-err">{dict.error}</div>}
    </div>
  );
}
