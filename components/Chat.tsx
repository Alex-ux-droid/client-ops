"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/repo/chat";
import { useDictation } from "./useDictation";

const PRESETS_GLOBAL = [
  "Що в мене сьогодні і що горить?",
  "Хто з клієнтів потребує уваги?",
  "Новий клієнт: ",
  "Склади план на тиждень",
];
const PRESETS_CLIENT = [
  "Коротко: що з цим клієнтом?",
  "Запропонуй наступні кроки",
  "Розбери переписку і внеси все в систему:\n\n",
  "Чернетка повідомлення клієнту",
];

type Msg = Pick<ChatMessage, "role" | "content" | "actions">;

export default function Chat({ clientId, page, initial, hasKey: hasKeyProp, compact }: {
  clientId: number | null;
  page?: string;
  initial?: Msg[];
  hasKey?: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const [msgs, setMsgs] = useState<Msg[]>(initial ?? []);
  const [hasKey, setHasKey] = useState(hasKeyProp ?? true);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const dict = useDictation((chunk) => setText((t) => (t && !t.endsWith(" ") && !t.endsWith("\n") ? `${t} ${chunk}` : t + chunk)));

  // Без initial (плаваюча панель) — підвантажуємо розмову самі
  useEffect(() => {
    if (initial) return;
    fetch(`/api/chat?clientId=${clientId ?? ""}`).then((r) => r.json()).then((d) => {
      setMsgs(d.messages ?? []);
      setHasKey(!!d.hasKey);
    }).catch(() => {});
  }, [clientId, initial]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs, busy]);

  async function send(message: string) {
    if (!message.trim() || busy) return;
    dict.stop();
    setErr("");
    setBusy(true);
    setMsgs((m) => [...m, { role: "user", content: message, actions: [] }]);
    setText("");
    try {
      const r = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message, clientId, page }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Помилка");
      setMsgs((m) => [...m, { role: "assistant", content: data.reply, actions: data.actions }]);
      if (data.actions?.length) router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка");
      setMsgs((m) => m.slice(0, -1));
      setText(message);
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ clear: true, clientId }) });
    setMsgs([]);
  }

  if (!hasKey) {
    return <div className="card">Помічник ще не підключений. <Link href="/settings?tab=access" style={{ color: "var(--cyan)" }}>Додай ключ API в Налаштуваннях →</Link></div>;
  }

  const presets = clientId ? PRESETS_CLIENT : PRESETS_GLOBAL;
  return (
    <div className={`chat ${compact ? "compact" : ""}`}>
      <div className="chat-log">
        {!msgs.length && (
          <div className="chat-hello">
            <b>Говори або пиши — я все розкладу по системі.</b>
            <span>Напр.: «Новий клієнт — автосервіс Мотор, Київ, хочуть ліди на ТО, бюджет 600 доларів, я беру 350 на місяць, завтра відправити КП».</span>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>
            <div className="bubble-text">{m.content}</div>
            {m.actions?.length > 0 && (
              <div className="meta" style={{ marginTop: 8 }}>
                {m.actions.map((a, j) => a.href
                  ? <Link key={j} href={a.href} className="tag ok">✓ {a.text}</Link>
                  : <span key={j} className="tag ok">✓ {a.text}</span>)}
              </div>
            )}
          </div>
        ))}
        {busy && <div className="bubble assistant"><div className="bubble-text typing">Думаю і вношу в базу…</div></div>}
        <div ref={end} />
      </div>
      {err && <div className="mono" style={{ color: "var(--bad)" }}>{err}</div>}
      {!msgs.length && (
        <div className="chips">
          {presets.map((p) => (
            <button key={p} className="ghost small" disabled={busy}
              onClick={() => (p.endsWith(" ") || p.endsWith("\n") ? (setText(p), box.current?.focus()) : send(p))}>
              {p.trim().replace(/:$/, "")}
            </button>
          ))}
        </div>
      )}
      <form className="chat-input" onSubmit={(e) => { e.preventDefault(); send(text); }}>
        <div className="chat-box">
          <textarea
            ref={box}
            id={compact ? "dock-text" : "chat-text"}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(text); } }}
            placeholder={dict.listening ? "Слухаю… говори" : "Напиши, встав переписку або натисни мікрофон"}
            aria-label="Повідомлення"
          />
          <button type="button" className={`mic ${dict.listening ? "on" : ""}`} onClick={dict.toggle} disabled={busy}
            title={dict.supported ? (dict.listening ? "Зупинити" : "Диктувати") : "Браузер не підтримує диктування — використай мікрофон на клавіатурі"}
            aria-label="Диктувати">
            {dict.listening ? "■" : "🎙"}
          </button>
        </div>
        {dict.error && <div className="mono" style={{ color: "var(--warn)" }}>{dict.error}</div>}
        <div className="inline" style={{ justifyContent: "space-between" }}>
          <button type="button" className="ghost small" onClick={clear} disabled={busy || !msgs.length}>Нова розмова</button>
          <button disabled={busy || !text.trim()}>{busy ? "…" : "Надіслати"}</button>
        </div>
      </form>
    </div>
  );
}
