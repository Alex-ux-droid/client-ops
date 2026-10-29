"use client";
import Icon from "@/components/Icon";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useDictation } from "@/components/useDictation";
import { addDevAction } from "@/app/actions";

export function CopyExport({ disabled }: { disabled: boolean }) {
  const [state, setState] = useState("");
  return (
    <button type="button" className="ghost" disabled={disabled} onClick={async () => {
      const text = await (await fetch("/api/journal/export")).text();
      try { await navigator.clipboard.writeText(text); setState("Скопійовано"); } catch { setState("Не вдалось скопіювати"); }
      setTimeout(() => setState(""), 2500);
    }}>{state || "Копіювати текст"}</button>
  );
}

// Після завантаження файлу оновити сторінку (записи пішли в архів)
export function DownloadExport({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  return (
    <form method="post" action="/api/journal/export" onSubmit={() => setTimeout(() => router.refresh(), 1200)}>
      <button disabled={disabled}>Експорт для Claude (.md)</button>
    </form>
  );
}

export function AddEntry() {
  const [text, setText] = useState("");
  const dict = useDictation((chunk) => setText((t) => (t && !t.endsWith(" ") ? `${t} ${chunk}` : t + chunk)));
  return (
    <form data-nodraft action={async (fd) => { await addDevAction(fd); setText(""); }} className="card stack">
      <div className="inline" style={{ flexWrap: "wrap" }}>
        <select name="kind" defaultValue="request" aria-label="Тип" style={{ maxWidth: "12rem" }}>
          <option value="request">Доробити</option>
          <option value="bug">Глюк</option>
          <option value="note">Нюанс</option>
        </select>
        <input name="title" placeholder="Коротко: що треба" required aria-label="Заголовок" />
      </div>
      <div className="chat-box">
        <textarea name="body" value={text} onChange={(e) => setText(e.target.value)} placeholder="Деталі — можна надиктувати" aria-label="Деталі" />
        <button type="button" className={`mic ${dict.listening ? "on" : ""}`} onClick={dict.toggle} disabled={dict.transcribing} aria-label="Диктувати">
          {dict.transcribing ? <span className="mic-wait" /> : dict.listening ? <span className="mic-stop" /> : <Icon name="mic" size={22} />}
        </button>
      </div>
      {dict.error && <div className="mono" style={{ color: "var(--warn)" }}>{dict.error}</div>}
      <div><button>Додати в журнал</button></div>
    </form>
  );
}
