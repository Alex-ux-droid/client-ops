"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/repo/chat";

const PRESETS_GLOBAL = [
  "Що в мене сьогодні і що горить?",
  "Хто з клієнтів потребує уваги і що з ними робити?",
  "Підсумуй гроші за місяць",
  "Склади план на тиждень",
];
const PRESETS_CLIENT = [
  "Коротко: що з цим клієнтом зараз?",
  "Запропонуй наступні кроки",
  "Розбери переписку нижче і внеси все в систему:\n\n",
  "Чернетка повідомлення клієнту про результати",
];

type Msg = Pick<ChatMessage, "role" | "content" | "actions">;

export default function Chat({ clientId, initial, hasKey }: { clientId: number | null; initial: Msg[]; hasKey: boolean }) {
  const router = useRouter();
  const [msgs, setMsgs] = useState<Msg[]>(initial);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs, busy]);

  async function send(message: string) {
    if (!message.trim() || busy) return;
    setErr("");
    setBusy(true);
    setMsgs((m) => [...m, { role: "user", content: message, actions: [] }]);
    setText("");
    try {
      const r = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message, clientId }) });
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
    return <div className="card">Помічник ще не підключений. <Link href="/settings" style={{ color: "var(--cyan)" }}>Додай ключ API в Налаштуваннях →</Link></div>;
  }

  const presets = clientId ? PRESETS_CLIENT : PRESETS_GLOBAL;
  return (
    <div className="chat">
      <div className="chat-log">
        {!msgs.length && <div className="empty">Питай про клієнтів, задачі, гроші. Встав переписку — розберу і внесу в систему.</div>}
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
        {busy && <div className="bubble assistant"><div className="bubble-text typing">Думаю і перевіряю базу…</div></div>}
        <div ref={end} />
      </div>
      {err && <div className="mono" style={{ color: "var(--bad)" }}>{err}</div>}
      <div className="chips">
        {presets.map((p) => (
          <button key={p} className="ghost small" onClick={() => (p.endsWith("\n\n") ? (setText(p), box.current?.focus()) : send(p))} disabled={busy}>
            {p.trim().replace(/:$/, "")}
          </button>
        ))}
      </div>
      <form className="chat-input" onSubmit={(e) => { e.preventDefault(); send(text); }}>
        <textarea
          ref={box}
          id="chat-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(text); } }}
          placeholder="Напиши або встав переписку… (Ctrl+Enter — надіслати)"
          aria-label="Повідомлення"
        />
        <div className="inline" style={{ justifyContent: "space-between" }}>
          <button type="button" className="ghost small" onClick={clear} disabled={busy || !msgs.length}>Очистити розмову</button>
          <button disabled={busy || !text.trim()}>{busy ? "…" : "Надіслати"}</button>
        </div>
      </form>
    </div>
  );
}
