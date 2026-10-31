"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { taskCalendarAction, taskCloseWithLog, taskDelete, taskItemAdd, taskItemRemove, taskItemSet, taskLinkAdd, taskLinkRemove, taskPatch } from "@/app/actions";
import type { TaskItem, TaskLink, TaskRow } from "@/lib/repo/tasks";
import { openAssistant } from "./assistant";
import Markdown from "./Markdown";
import { OPEN_TASK } from "./tasks";
import VoiceTextarea from "./VoiceTextarea";

type Data = { task: TaskRow; items: TaskItem[]; links: TaskLink[]; drive_url: string; calendar: "ok" | "reconnect" | "off" };
const STATUS = [{ k: "todo", l: "Треба зробити" }, { k: "doing", l: "В роботі" }, { k: "done", l: "Готово" }] as const;
const PRIO = [{ k: "high", l: "Терміново" }, { k: "normal", l: "Звичайна" }, { k: "low", l: "Не горить" }] as const;

// Іконка і підпис посилання за адресою
function linkKind(url: string): { ico: string; label: string } {
  if (/drive\.google\.com\/drive\/folders/.test(url)) return { ico: "📁", label: "Папка на Диску" };
  if (/docs\.google\.com\/document/.test(url)) return { ico: "📄", label: "Google Документ" };
  if (/docs\.google\.com\/spreadsheets/.test(url)) return { ico: "📊", label: "Google Таблиця" };
  if (/docs\.google\.com\/presentation/.test(url)) return { ico: "📽", label: "Презентація" };
  if (/drive\.google\.com/.test(url)) return { ico: "📎", label: "Файл на Диску" };
  if (/t\.me\//.test(url)) return { ico: "✈️", label: "Telegram" };
  if (/facebook\.com|fb\.me|business\.facebook/.test(url)) return { ico: "📣", label: "Facebook" };
  if (/figma\.com/.test(url)) return { ico: "🎨", label: "Figma" };
  if (/youtube\.com|youtu\.be|loom\.com/.test(url)) return { ico: "▶️", label: "Відео" };
  try { return { ico: "🔗", label: new URL(url).hostname.replace(/^www\./, "") }; } catch { return { ico: "🔗", label: url }; }
}

// Вікно задачі: відкривається подією openTask(id) або адресою ?task=ID з будь-якої сторінки
export default function TaskModal() {
  const router = useRouter();
  const params = useSearchParams();
  const [id, setId] = useState<number | null>(null);
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [editDetails, setEditDetails] = useState(false);
  const [closing, setClosing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [calMsg, setCalMsg] = useState("");
  const newItem = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const on = (e: Event) => setId((e as CustomEvent<number>).detail);
    window.addEventListener(OPEN_TASK, on);
    return () => window.removeEventListener(OPEN_TASK, on);
  }, []);
  useEffect(() => {
    const q = Number(params.get("task"));
    if (q) setId(q);
  }, [params]);

  const load = useCallback(async (tid: number) => {
    const r = await fetch(`/api/tasks/${tid}`, { cache: "no-store" });
    if (!r.ok) { setErr(r.status === 404 ? "Задачу не знайдено — можливо, її видалили." : "Не вдалось відкрити задачу."); return; }
    setD((await r.json()) as Data);
  }, []);

  useEffect(() => {
    if (id == null) return;
    setD(null); setErr(""); setEditDetails(false); setClosing(false); setCalMsg("");
    void load(id);
    document.documentElement.classList.add("locked");
    const key = (e: KeyboardEvent) => { if (e.key === "Escape" && !(e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement)) close(); };
    window.addEventListener("keydown", key);
    return () => { window.removeEventListener("keydown", key); document.documentElement.classList.remove("locked"); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, load]);

  function close() {
    setId(null); setD(null);
    if (params.get("task")) {
      const u = new URL(window.location.href);
      u.searchParams.delete("task");
      router.replace(u.pathname + u.search, { scroll: false });
    }
  }

  // Будь-яка зміна: зберегти → перечитати задачу → оновити списки під вікном
  async function run(fn: () => Promise<unknown>) {
    if (id == null) return;
    setBusy(true);
    try { await fn(); await load(id); router.refresh(); } finally { setBusy(false); }
  }

  if (id == null) return null;
  const t = d?.task;
  const done = t?.status === "done";
  const total = d?.items.length ?? 0, ok = d?.items.filter((i) => i.done).length ?? 0;

  return (
    <div className="tm-over" onClick={close} role="dialog" aria-modal>
      <div className="tm-box" onClick={(e) => e.stopPropagation()}>
        {!d ? (
          <div className="tm-loading">{err || "Відкриваю…"}{err && <button type="button" className="ghost small" onClick={close}>Закрити</button>}</div>
        ) : (
          <>
            <div className="tm-head">
              <button type="button" className={`tm-check ${done ? "on" : ""}`} title={done ? "Повернути в роботу" : "Готово"} disabled={busy}
                onClick={() => run(() => taskPatch(id, { status: done ? "todo" : "done" }))}>✓</button>
              <input key={`t${t!.id}${t!.title}`} className="tm-title" defaultValue={t!.title} aria-label="Назва задачі"
                onBlur={(e) => e.target.value.trim() && e.target.value !== t!.title && run(() => taskPatch(id, { title: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} />
              <button type="button" className="ghost small tm-x" onClick={close} aria-label="Закрити">✕</button>
            </div>

            <div className="tm-meta">
              <div className="tm-seg">
                {STATUS.map((s) => <button key={s.k} type="button" className={t!.status === s.k ? "on" : ""} disabled={busy} onClick={() => run(() => taskPatch(id, { status: s.k }))}>{s.l}</button>)}
              </div>
              <select value={t!.priority} onChange={(e) => run(() => taskPatch(id, { priority: e.target.value }))} className={`tm-prio p-${t!.priority}`} aria-label="Пріоритет">
                {PRIO.map((p) => <option key={p.k} value={p.k}>{p.l}</option>)}
              </select>
              <input type="date" value={t!.due_date ?? ""} onChange={(e) => run(() => taskPatch(id, { due_date: e.target.value || null }))} aria-label="Дедлайн" />
              {t!.client_id && <Link href={`/clients/${t!.client_id}`} className="tag" onClick={close}>{t!.client_name}</Link>}
            </div>

            <div className="tm-body">
              <section>
                <div className="tm-sec-head">
                  <b>Підзадачі</b>
                  {total > 0 && <span>{ok} з {total}</span>}
                </div>
                {total > 0 && <div className="tm-progress"><i style={{ width: `${(ok / total) * 100}%` }} /></div>}
                <ul className="tm-items">
                  {d.items.map((i) => (
                    <li key={i.id} className={i.done ? "done" : ""}>
                      <button type="button" className={`tm-box-check ${i.done ? "on" : ""}`} onClick={() => run(() => taskItemSet(i.id, { done: !i.done }))} aria-label="Відмітити">✓</button>
                      <span contentEditable suppressContentEditableWarning className="tm-item-text"
                        onBlur={(e) => { const v = e.currentTarget.textContent ?? ""; if (v.trim() && v !== i.text) void run(() => taskItemSet(i.id, { text: v })); }}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }}>{i.text}</span>
                      <button type="button" className="tm-del" onClick={() => run(() => taskItemRemove(i.id))} aria-label="Видалити">✕</button>
                    </li>
                  ))}
                </ul>
                <form className="tm-add" onSubmit={(e) => { e.preventDefault(); const v = newItem.current?.value ?? ""; if (!v.trim()) return; void run(() => taskItemAdd(id, v)).then(() => { if (newItem.current) newItem.current.value = ""; }); }}>
                  <VoiceTextarea ref={newItem} rows={1} placeholder="+ Нова підзадача" title="Можна кілька — кожна з нового рядка (Shift+Enter)"
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} />
                  <button className="small" disabled={busy}>Додати</button>
                </form>
              </section>

              <section>
                <div className="tm-sec-head">
                  <b>Інструкція і деталі</b>
                  <button type="button" className="ghost small" onClick={() => setEditDetails((x) => !x)}>{editDetails ? "Скасувати" : t!.details ? "Редагувати" : "Додати"}</button>
                </div>
                {editDetails ? (
                  <form onSubmit={(e) => { e.preventDefault(); const v = (new FormData(e.currentTarget).get("details") as string) ?? ""; void run(() => taskPatch(id, { details: v })).then(() => setEditDetails(false)); }}>
                    <VoiceTextarea name="details" defaultValue={t!.details} rows={10} className="tm-details-edit" placeholder={"Як зробити, кроки, нюанси.\n1. Перший крок\n2. Другий\n**жирне**, посилання https://…"} autoFocus />
                    <button disabled={busy}>Зберегти</button>
                  </form>
                ) : t!.details ? (
                  <div className="tm-details"><Markdown md={t!.details} /></div>
                ) : (
                  <p className="tm-empty">Нема. Тут можна тримати покрокову інструкцію — або попроси Джері написати.</p>
                )}
              </section>

              <section>
                <div className="tm-sec-head"><b>Посилання і файли</b></div>
                <div className="tm-links">
                  {d.drive_url && (
                    <a href={d.drive_url} target="_blank" rel="noreferrer" className="tm-link"><span>📁</span><b>Папка клієнта на Диску</b><em>Google Диск</em></a>
                  )}
                  {d.links.map((l) => {
                    const k = linkKind(l.url);
                    return (
                      <div key={l.id} className="tm-link">
                        <span>{k.ico}</span>
                        <a href={l.url} target="_blank" rel="noreferrer"><b>{l.title || k.label}</b><em>{l.title ? k.label : l.url.replace(/^https?:\/\//, "").slice(0, 60)}</em></a>
                        <button type="button" className="tm-del" onClick={() => run(() => taskLinkRemove(l.id))} aria-label="Прибрати">✕</button>
                      </div>
                    );
                  })}
                </div>
                <form className="tm-add tm-add-link" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); const form = e.currentTarget; void run(() => taskLinkAdd(id, String(f.get("url") ?? ""), String(f.get("title") ?? ""))).then(() => form.reset()); }}>
                  <input name="url" type="url" placeholder="https://… (Диск, документ, Telegram)" required />
                  <input name="title" placeholder="Назва (необовʼязково)" />
                  <button className="small" disabled={busy}>Додати</button>
                </form>
              </section>
            </div>

            <div className="tm-foot">
              {!done && !closing && <button type="button" onClick={() => setClosing(true)}>✓ Закрити зі звітом</button>}
              {d.calendar === "ok" ? (
                <button type="button" className="ghost" disabled={busy} title={t!.due_date ? "Подія на день дедлайну з нагадуванням напередодні" : "Спершу постав дедлайн"}
                  onClick={() => run(async () => { const r = await taskCalendarAction(id); setCalMsg(r.ok ? "Є в Google Календарі ✓" : r.error ?? "Не вдалось"); })}>
                  📅 {t!.gcal_event_id ? "Оновити в календарі" : "В Google Календар"}
                </button>
              ) : d.calendar === "reconnect" ? (
                <Link href="/settings?tab=connectors&c=google" className="btn ghost" onClick={close} title="Доступ до Календаря додали пізніше — треба один раз перепідключити Google">📅 Календар: перепідключи Google</Link>
              ) : null}
              <button type="button" className="ghost" onClick={() => { close(); openAssistant(`Допоможи з задачею #${id} «${t!.title}»${t!.client_name ? ` (${t!.client_name})` : ""}: розпиши, як її зробити, онови підзадачі й інструкцію.`, true); }}>Джері, допоможи</button>
              <span style={{ flex: 1 }} />
              <button type="button" className="ghost small tm-danger" onClick={() => { if (confirm("Видалити задачу назавжди?")) void taskDelete(id).then(() => { close(); router.refresh(); }); }}>Видалити</button>
            </div>
            {calMsg && <div className="mono" style={{ marginTop: "-0.5rem" }}>{calMsg}</div>}
            {t!.gcal_event_id && !calMsg && <div className="mono" style={{ marginTop: "-0.5rem" }}>📅 Є в Google Календарі — оновлюється сам, коли міняєш назву, дату чи статус.</div>}
            {closing && (
              <form className="tm-close" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); void run(() => taskCloseWithLog(id, { what: String(f.get("what") ?? ""), why: String(f.get("why") ?? ""), result: String(f.get("result") ?? "") })).then(() => setClosing(false)); }}>
                <input name="what" defaultValue={t!.title} placeholder="Що зробив" />
                <input name="why" placeholder="Навіщо" />
                <input name="result" placeholder="Результат" />
                {!t!.client_id && <div className="mono">Задача без клієнта: в історію не піде, просто закриється.</div>}
                <div className="inline"><button disabled={busy}>Закрити задачу</button><button type="button" className="ghost" onClick={() => setClosing(false)}>Скасувати</button></div>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
