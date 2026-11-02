"use client";
// Вікно «Повідомлення клієнту»: шаблон → (що сказати) → чернетка від Джері → правка → копіювати / надіслати в групу від бота.
import { useEffect, useRef, useState } from "react";
import { commProfileBuildAction, commProfileSaveAction, msgDraftAction, msgPromisesAction, msgPromisesSaveAction, msgSendAction, msgSetupAction } from "@/app/messages/actions";
import { OPEN_CLIENT_MSG, type ClientMsgTarget } from "./tasks";
import VoiceTextarea from "./VoiceTextarea";

type Setup = Awaited<ReturnType<typeof msgSetupAction>>;

export default function ClientMessage() {
  const [target, setTarget] = useState<ClientMsgTarget | null>(null);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [tpl, setTpl] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<"" | "draft" | "send">("");
  const [msg, setMsg] = useState("");
  const note = useRef<HTMLTextAreaElement>(null);
  const [profile, setProfile] = useState("");
  const [profBusy, setProfBusy] = useState(false);
  const [profMsg, setProfMsg] = useState("");
  type P = { what: string; due: string | null; on: boolean };
  const [promises, setPromises] = useState<P[] | null>(null);
  const [promMsg, setPromMsg] = useState("");

  useEffect(() => {
    const on = (e: Event) => {
      const t = (e as CustomEvent<ClientMsgTarget>).detail;
      setTarget(t); setSetup(null); setTpl(null); setText(""); setMsg(""); setProfile(""); setProfMsg(""); setPromises(null); setPromMsg("");
      void msgSetupAction(t.clientId).then((s) => { setSetup(s); setTpl(s.templates[0]?.id ?? null); setProfile(s.profile); });
    };
    window.addEventListener(OPEN_CLIENT_MSG, on);
    return () => window.removeEventListener(OPEN_CLIENT_MSG, on);
  }, []);
  useEffect(() => {
    if (!target) return;
    document.documentElement.classList.add("locked");
    const esc = (e: KeyboardEvent) => e.key === "Escape" && !busy && setTarget(null);
    window.addEventListener("keydown", esc);
    return () => { document.documentElement.classList.remove("locked"); window.removeEventListener("keydown", esc); };
  }, [target, busy]);

  if (!target) return null;
  const close = () => !busy && setTarget(null);

  async function draft(again: boolean) {
    if (!tpl || !target) return;
    setBusy("draft"); setMsg("");
    const r = await msgDraftAction({ clientId: target.clientId, taskId: target.taskId ?? null, templateId: tpl, note: note.current?.value ?? "", previous: again ? text : "" });
    setBusy("");
    if (r.ok) setText(r.text); else setMsg(r.error);
  }
  async function copy() {
    try { await navigator.clipboard.writeText(text); setMsg("Скопійовано ✓"); } catch { setMsg("Не вдалось скопіювати — виділи текст вручну"); }
    void findPromises();
  }
  async function findPromises() {
    setPromMsg(""); setPromises(null);
    const r = await msgPromisesAction(text);
    setPromises(r.map((x) => ({ ...x, on: true })));
  }
  async function savePromises() {
    if (!target || !promises) return;
    const r = await msgPromisesSaveAction(target.clientId, promises.filter((p) => p.on).map(({ what, due }) => ({ what, due })), text);
    setPromises(null); setPromMsg(r.count ? `Поставив ${r.count} нагадування в задачі ✓` : "Нічого не поставлено");
  }
  async function buildProfile() {
    if (!target) return;
    setProfBusy(true); setProfMsg("");
    const r = await commProfileBuildAction(target.clientId);
    setProfBusy(false);
    if (r.ok) { setProfile(r.profile); setProfMsg("Склав з переписки ✓"); } else setProfMsg(r.error);
  }
  async function saveProfile() {
    if (!target) return;
    await commProfileSaveAction(target.clientId, profile);
    setProfMsg("Збережено — автоматика його більше не перезапише ✓");
  }
  async function send(chatId: number, title: string) {
    if (!target || !confirm(`Надіслати в групу «${title}» від бота?`)) return;
    setBusy("send"); setMsg("");
    const r = await msgSendAction(target.clientId, chatId, text);
    setBusy("");
    setMsg(r.ok ? `Надіслано в «${title}» ✓` : r.error ?? "Не вдалось");
    if (r.ok) void findPromises();
  }

  return (
    <div className="tm-over" onClick={close} role="dialog" aria-modal aria-label="Повідомлення клієнту">
      <div className="tm-box cm-box" onClick={(e) => e.stopPropagation()}>
        <div className="tm-head">
          <div className="grow" style={{ minWidth: 0 }}>
            <h2 className="cm-title">Повідомлення клієнту</h2>
            <div className="mono">{target.clientName}{target.taskId ? " · з цієї задачі, цифр реклами і переписки" : " · з цифр реклами і переписки"}</div>
          </div>
          <button type="button" className="ghost small tm-x" onClick={close} aria-label="Закрити">✕</button>
        </div>
        {!setup ? <div className="tm-loading">Відкриваю…</div> : !setup.on ? (
          <p className="mono">Вимкнено: Налаштування → Можливості → «Повідомлення клієнтам».</p>
        ) : (
          <div className="cm-body">
            <details className="cm-prof">
              <summary>Як спілкуємось з клієнтом <span className="mono">{profile ? (setup.profileSource === "manual" ? "· правив ти" : "· з переписки") : setup.texts >= 8 ? "· складеться сам при першій чернетці" : "· ще нема"}</span></summary>
              <textarea value={profile} onChange={(e) => setProfile(e.target.value)} rows={7} placeholder={"Звертання: Миколо, на «ви»\nХто вирішує: …\nТон і довжина: …\nЩо цікавить: …\nЧого уникати: …"} aria-label="Профіль спілкування" />
              <div className="cm-row">
                <button type="button" className="ghost small" onClick={saveProfile}>Зберегти</button>
                <button type="button" className="ghost small" disabled={profBusy || setup.texts < 8} onClick={buildProfile} title={setup.texts < 8 ? "Замало переписки в групі" : "Перечитати переписку і скласти заново"}>{profBusy ? "Читаю переписку…" : "Скласти з переписки"}</button>
                <span className="mono">{setup.texts} повідомлень у групі</span>
              </div>
              {profMsg && <div className="mono cm-msg">{profMsg}</div>}
            </details>
            <div className="cm-label">Про що пишемо</div>
            <div className="cm-tpls">
              {setup.templates.map((t) => <button key={t.id} type="button" className={`cm-tpl ${tpl === t.id ? "on" : ""}`} title={t.when_hint} onClick={() => setTpl(t.id)}>{t.title}</button>)}
            </div>
            <VoiceTextarea ref={note} rows={2} placeholder="Що обовʼязково сказати (не обовʼязково): «вже опубліковано», «зустріч о 13:00», сума, дата…" className="cm-note" />
            <div className="cm-row">
              <button type="button" disabled={!tpl || !!busy} onClick={() => draft(false)}>{busy === "draft" ? "Джері пише…" : text ? "Скласти заново" : "Скласти"}</button>
              {text && <button type="button" className="ghost" disabled={!!busy} onClick={() => draft(true)} title="Інший варіант з урахуванням уточнення вище">Інакше</button>}
              <a href="/settings?tab=messages" className="cm-edit">шаблони →</a>
            </div>
            {text && (
              <>
                <textarea className="cm-text" value={text} onChange={(e) => setText(e.target.value)} rows={Math.min(18, text.split("\n").length + 3)} aria-label="Текст повідомлення" />
                <div className="cm-row">
                  <button type="button" onClick={copy}>Копіювати</button>
                  {setup.canSend && setup.chats.map((c) => (
                    <button key={c.chat_id} type="button" className="ghost" disabled={!!busy} onClick={() => send(c.chat_id, c.title)}>{busy === "send" ? "Надсилаю…" : `В групу «${c.title}» від бота`}</button>
                  ))}
                </div>
                <div className="mono">Перевір цифри і факти перед відправкою. Від бота — підпис «Джері»; хочеш від себе — копіюй.</div>
              </>
            )}
            {msg && <div className="mono cm-msg">{msg}</div>}
            {promises && promises.length > 0 && (
              <div className="cm-prom">
                <b>У тексті є обіцянки — поставити нагадування?</b>
                {promises.map((p, i) => (
                  <div key={i} className="cm-prom-row">
                    <input type="checkbox" checked={p.on} onChange={(e) => setPromises(promises.map((x, j) => (j === i ? { ...x, on: e.target.checked } : x)))} aria-label="Поставити" />
                    <input value={p.what} onChange={(e) => setPromises(promises.map((x, j) => (j === i ? { ...x, what: e.target.value } : x)))} aria-label="Що" />
                    <input type="date" value={p.due ?? ""} onChange={(e) => setPromises(promises.map((x, j) => (j === i ? { ...x, due: e.target.value || null } : x)))} aria-label="До" />
                  </div>
                ))}
                <div className="cm-row"><button type="button" className="small" onClick={savePromises}>Поставити в задачі</button><button type="button" className="ghost small" onClick={() => setPromises(null)}>Не треба</button></div>
              </div>
            )}
            {promMsg && <div className="mono cm-msg">{promMsg}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
