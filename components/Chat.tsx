"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/repo/chat";
import type { AssistantSeed } from "./assistant";
import Bot from "./Bot";
import Icon from "./Icon";
import DictOverlay from "./DictOverlay";
import { readChatFile, type ChatFile } from "./chatFiles";
import { useDictation } from "./useDictation";
import { useSpeech } from "./useSpeech";

const PRESETS_GLOBAL = [
  "Розкажи підсумок дня — послухаю",
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

// Що зараз на екрані: адреса, заголовок, активна вкладка і текст сторінки (без меню і самого чату)
// Задача, з якою Саша працює: відкрита зараз або закрита не більше 20 хв тому
function currentTask(): number | null {
  const ds = document.documentElement.dataset;
  const id = Number(ds.task), at = Number(ds.taskAt);
  return id && (ds.taskOpen === "1" || (at && Date.now() - at < 20 * 60_000)) ? id : null;
}

function screenText(): string {
  const main = document.querySelector("main");
  if (!main) return "";
  const title = main.querySelector("h1")?.textContent || main.querySelector(".hub-compact-name b")?.textContent || "";
  const tab = main.querySelector(".subnav a.on, .tabs a.on")?.textContent || "";
  const body = (main.innerText || "").replace(/\n{2,}/g, "\n").trim().slice(0, 3200);
  return [`Адреса: ${location.pathname}${location.search}`, title && `Заголовок: ${title}`, tab && `Вкладка: ${tab}`, body].filter(Boolean).join("\n");
}

export default function Chat({ clientId, page, initial, hasKey: hasKeyProp, compact, seed, onState }: {
  clientId: number | null;
  page?: string;
  initial?: Msg[];
  hasKey?: boolean;
  compact?: boolean;
  seed?: AssistantSeed | null;
  onState?: (s: "idle" | "listening" | "thinking" | "speaking") => void;
}) {
  const router = useRouter();
  const [msgs, setMsgs] = useState<Msg[]>(initial ?? []);
  const [hasKey, setHasKey] = useState(hasKeyProp ?? true);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const [speaking, setSpeaking] = useState(false);
  const voice = useSpeech(setSpeaking);
  // Диктування: поки говориш — почуте сірим поверх поля; на «стоп» — причесаний текст іде в поле білим
  const [heard, setHeard] = useState("");
  const [files, setFiles] = useState<ChatFile[]>([]);
  const [menu, setMenu] = useState(false);
  const [prefs, setPrefs] = useState<{ web: boolean; context: boolean }>({ web: true, context: true });
  const fileIn = useRef<HTMLInputElement>(null);
  const camIn = useRef<HTMLInputElement>(null);
  const addFiles = async (list: FileList | File[] | null) => {
    if (!list) return;
    setMenu(false);
    for (const f of Array.from(list).slice(0, 6)) {
      try { const cf = await readChatFile(f); setFiles((x) => [...x, cf].slice(0, 6)); } catch (e) { setErr(e instanceof Error ? e.message : "Не вдалось прочитати файл"); }
    }
  };
  const togglePref = (key: "web" | "context") => {
    const on = !prefs[key];
    setPrefs((p) => ({ ...p, [key]: on }));
    void fetch("/api/chat/prefs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key, on }) });
  };
  const join = (b: string, h: string) => (h ? (b && !b.endsWith(" ") && !b.endsWith("\n") ? `${b} ${h}` : b + h) : b);
  const dict = useDictation(
    (chunk) => { setHeard(""); setText((t) => join(t, chunk)); },
    setHeard,
  );

  // Без initial (плаваюча панель) — підвантажуємо розмову самі
  useEffect(() => {
    if (initial) return;
    fetch(`/api/chat?clientId=${clientId ?? ""}`).then((r) => r.json()).then((d) => {
      setMsgs(d.messages ?? []);
      setHasKey(!!d.hasKey);
      if (d.prefs) setPrefs(d.prefs);
    }).catch(() => {});
  }, [clientId, initial]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs, busy]);

  // Робот у шапці: слухає / думає
  useEffect(() => { onState?.(busy ? "thinking" : dict.listening ? "listening" : speaking ? "speaking" : "idle"); }, [busy, dict.listening, speaking, onState]);

  // Запит від сторінки (кнопка «Розгорнути з помічником» тощо)
  const seen = useRef(0);
  useEffect(() => {
    if (!seed || seed.n === seen.current) return;
    seen.current = seed.n;
    if (seed.send) void send(seed.text);
    else { setText(seed.text); box.current?.focus(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  async function send(message: string) {
    if ((!message.trim() && !files.length) || busy) return;
    const att = files;
    if (voice.enabled) voice.prime();
    dict.stop();
    setErr("");
    setBusy(true);
    setMsgs((m) => [...m, { role: "user", content: att.length ? `${message}\n📎 ${att.map((f) => f.name).join(", ")}`.trim() : message, actions: [] }]);
    setText("");
    setFiles([]);
    try {
      const r = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message, clientId, page, screen: compact ? screenText() : "", taskId: currentTask(), files: att.map(({ name, type, data }) => ({ name, type, data })) }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Помилка");
      setMsgs((m) => [...m, { role: "assistant", content: data.reply, actions: data.actions }]);
      if (voice.enabled) voice.speak(data.reply);
      if (data.actions?.length) router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка");
      setMsgs((m) => m.slice(0, -1));
      setText(message);
      setFiles(att);
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ clear: true, clientId }) });
    setMsgs([]);
  }

  if (!hasKey) {
    return <div className="card">Джері ще не підключений. <Link href="/settings?tab=access" style={{ color: "var(--link)" }}>Додай ключ API в Налаштуваннях →</Link></div>;
  }

  const presets = clientId ? PRESETS_CLIENT : PRESETS_GLOBAL;
  return (
    <div className={`chat ${compact ? "compact" : ""}`}>
      <div className="chat-log">
        {!msgs.length && (
          <div className="chat-hello">
            <b>Натисни мікрофон і скажи, що треба — я все розкладу по системі.</b>
            <span>Напр.: «Новий клієнт — автосервіс Мотор, Київ, хочуть ліди на ТО, бюджет 600 доларів, я беру 350 на місяць, завтра відправити КП».</span>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>
            {m.role === "assistant" && compact && <Bot size={26} className="bot-xs" />}
            <div className="bubble-text">{m.content}</div>
            {m.actions?.length > 0 && (
              <div className="meta" style={{ marginTop: 8 }}>
                {m.actions.map((a, j) => a.href?.startsWith("/api/")
                  ? <a key={j} href={a.href} target="_blank" rel="noreferrer" className="tag ok">📄 {a.text}</a>
                  : a.href
                  ? <Link key={j} href={a.href} className="tag ok">✓ {a.text}</Link>
                  : <span key={j} className="tag ok">✓ {a.text}</span>)}
              </div>
            )}
          </div>
        ))}
        {busy && <div className="bubble assistant">{compact && <Bot size={26} state="thinking" className="bot-xs" />}<div className="bubble-text typing">Секунду…</div></div>}
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
      <form data-nodraft className="chat-input" onSubmit={(e) => { e.preventDefault(); send(text); }}>
        {files.length > 0 && (
          <div className="chat-files">
            {files.map((f, i) => (
              <div key={i} className="chat-file" title={f.name}>
                {f.preview ? <img src={f.preview} alt="" /> : <span className="chat-file-ico"><Icon name="paperclip" size={16} /></span>}
                <span className="chat-file-name">{f.name}</span>
                <button type="button" onClick={() => setFiles((x) => x.filter((_, j) => j !== i))} aria-label="Прибрати">×</button>
              </div>
            ))}
          </div>
        )}
        <div className="chat-box" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void addFiles(e.dataTransfer.files); }}>
          <input ref={fileIn} type="file" multiple accept="image/*,application/pdf,.txt,.md,.csv,.json" hidden onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} />
          <input ref={camIn} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} />
          <button type="button" className={`chat-plus ${menu ? "on" : ""}`} onClick={() => setMenu((m) => !m)} aria-label="Меню: файли, налаштування" aria-expanded={menu}><Icon name="plus" size={20} /></button>
          {menu && (
            <>
              <div className="chat-menu-shade" onClick={() => setMenu(false)} />
              <div className="chat-menu" role="menu">
                <button type="button" role="menuitem" onClick={() => fileIn.current?.click()}><Icon name="paperclip" size={18} /><span>Фото або файл<small>картинки, PDF, текст — або встав Ctrl+V</small></span></button>
                <button type="button" role="menuitem" className="only-touch" onClick={() => camIn.current?.click()}><Icon name="camera" size={18} /><span>Зробити фото</span></button>
                <hr />
                <button type="button" role="menuitemcheckbox" aria-checked={prefs.web} onClick={() => togglePref("web")}><span className="chat-menu-ico">🌐</span><span>Пошук в інтернеті</span><i className={`chat-sw ${prefs.web ? "on" : ""}`} /></button>
                <button type="button" role="menuitemcheckbox" aria-checked={prefs.context} onClick={() => togglePref("context")}><span className="chat-menu-ico">👁</span><span>Бачить задачу і рекламу<small>з кожним повідомленням</small></span><i className={`chat-sw ${prefs.context ? "on" : ""}`} /></button>
                {voice.supported && <button type="button" role="menuitemcheckbox" aria-checked={voice.enabled} onClick={voice.toggle}><Icon name={voice.enabled ? "volume" : "mute"} size={18} /><span>Читати відповіді вголос</span><i className={`chat-sw ${voice.enabled ? "on" : ""}`} /></button>}
                <hr />
                <button type="button" role="menuitem" disabled={busy || !msgs.length} onClick={() => { setMenu(false); void clear(); }}><span className="chat-menu-ico">✦</span><span>Нова розмова</span></button>
              </div>
            </>
          )}
          <textarea
            ref={box}
            id={compact ? "dock-text" : "chat-text"}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(text); } }}
            onPaste={(e) => { const fl = Array.from(e.clipboardData.files); if (fl.length) { e.preventDefault(); void addFiles(fl); } }}
            placeholder={dict.transcribing ? "Розпізнаю…" : dict.listening ? "Слухаю… говори, потім натисни стоп" : "Напиши, встав переписку або натисни мікрофон"}
            aria-label="Повідомлення"
          />
          {(dict.listening || dict.fixing) && <DictOverlay el={box.current} base={text} heard={heard} fixing={dict.fixing} />}
          <button type="button" className={`mic ${dict.listening ? "on" : ""} ${dict.transcribing ? "wait" : ""}`} onClick={() => { if (voice.enabled) voice.prime(); dict.toggle(); }} disabled={busy || dict.transcribing || dict.fixing}
            title={dict.supported ? (dict.listening ? "Зупинити" : "Диктувати") : "Браузер не підтримує диктування — використай мікрофон на клавіатурі"}
            aria-label="Диктувати">
            {dict.transcribing || dict.fixing ? <span className="mic-wait" /> : dict.listening ? <span className="mic-stop" /> : <Icon name="mic" size={22} />}
          </button>
        </div>
        {dict.error && <div className="mono" style={{ color: "var(--warn)" }}>{dict.error}</div>}
        {voice.error && <div className="mono" style={{ color: "var(--warn)" }}>Голос: {voice.error}</div>}
        {voice.enabled && !voice.hasUk && <div className="mono" style={{ color: "var(--dim)" }}>У цьому браузері нема українського голосу — читатиме з акцентом. На iPhone: Параметри → Універсальний доступ → Усний контент → Голоси → Українська.</div>}
        <div className="inline" style={{ justifyContent: "space-between" }}>
          <div className="inline">
            {speaking && (
              <button type="button" className="ghost small voice-btn" onClick={voice.stopSpeaking} title="Замовкнути (голос лишається увімкненим)">
                <span className="mic-stop dark" /> Стоп
              </button>
            )}
          </div>
          <button disabled={busy || dict.transcribing || dict.fixing || (!text.trim() && !files.length)}>{busy ? "…" : "Надіслати"}</button>
        </div>
      </form>
    </div>
  );
}
