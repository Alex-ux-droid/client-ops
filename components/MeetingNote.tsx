"use client";
// «Зустріч»: велике вікно для тез під час зустрічі з клієнтом. Пишеш або диктуєш — зберігається само кожні ~3 с
// (і копія в браузері на випадок, якщо пропаде інтернет). Можна закрити і продовжити ту саму зустріч пізніше.
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { refreshClientAction, saveMeetingAction } from "@/app/meetings/actions";
import Icon from "./Icon";
import VoiceTextarea from "./VoiceTextarea";

const today = () => new Date().toLocaleDateString("uk-UA", { day: "2-digit", month: "2-digit", year: "2-digit" });
const hm = () => new Date().toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" });

export default function MeetingNote({ clientId, clientName, meeting, label = "Зустріч", className = "btn ghost" }: {
  clientId: number; clientName: string; meeting?: { id: number; title: string; notes: string }; label?: string; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [id, setId] = useState(meeting?.id ?? 0);
  const [title, setTitle] = useState(meeting?.title ?? "");
  const [notes, setNotes] = useState(meeting?.notes ?? "");
  const [state, setState] = useState("");
  const dirty = useRef(false);
  const saving = useRef(false);
  const router = useRouter();
  const draftKey = `meeting.draft.${clientId}.${meeting?.id ?? "new"}`;

  const save = useCallback(async () => {
    if (!dirty.current || saving.current) return;
    saving.current = true; dirty.current = false;
    try {
      const nid = await saveMeetingAction(clientId, id, title || `Зустріч ${today()}`, notes);
      if (nid) { setId(nid); setState(`Збережено ${hm()}`); try { localStorage.removeItem(draftKey); } catch { /* приватний режим */ } }
    } catch { dirty.current = true; setState("Нема звʼязку — збережу, щойно зʼявиться (копія в браузері є)"); }
    saving.current = false;
  }, [clientId, id, title, notes, draftKey]);

  // Автозбереження: через 3 с після останньої зміни
  useEffect(() => {
    if (!open || !dirty.current) return;
    try { localStorage.setItem(draftKey, JSON.stringify({ title, notes })); } catch { /* ok */ }
    const t = setTimeout(save, 3000);
    return () => clearTimeout(t);
  }, [title, notes, open, save, draftKey]);

  // Відкрити: нова зустріч — підтягнути незбережену чернетку з браузера
  const start = () => {
    if (!meeting && !id) {
      let d: { title: string; notes: string } | null = null;
      try { d = JSON.parse(localStorage.getItem(draftKey) || "null"); } catch { /* ok */ }
      if (d?.notes) { setTitle(d.title || `Зустріч ${today()}`); setNotes(d.notes); dirty.current = true; }
      else if (!title) setTitle(`Зустріч ${today()}`);
    }
    setOpen(true);
    document.documentElement.classList.add("locked");
  };
  const close = async () => {
    await save();
    setOpen(false);
    document.documentElement.classList.remove("locked");
    await refreshClientAction(clientId);
    router.refresh();
    if (!meeting) { setId(0); setTitle(""); setNotes(""); setState(""); }
  };
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") void close(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  return (
    <>
      <button type="button" className={className} onClick={start} title={label}><Icon name="mic" size={15} /> <span className="lbl">{label}</span></button>
      {open && createPortal(
        <div className="mt-back" onMouseDown={(e) => { if (e.target === e.currentTarget) void close(); }}>
          <div className="mt-win" role="dialog" aria-label="Зустріч">
            <div className="mt-head">
              <div className="stack" style={{ gap: "0.125rem", minWidth: 0, flex: 1 }}>
                <span className="mono">{clientName}</span>
                <input className="mt-title" value={title} onChange={(e) => { dirty.current = true; setTitle(e.target.value); }} placeholder={`Зустріч ${today()}`} aria-label="Назва зустрічі" />
              </div>
              <button type="button" className="small" onClick={() => void close()}>Готово</button>
            </div>
            <VoiceTextarea className="mt-notes" value={notes} autoFocus onChange={(e) => { dirty.current = true; setNotes(e.target.value); }}
              placeholder={"Тези по ходу зустрічі, коротко:\n- що хоче клієнт\n- гроші, терміни, домовленості\n- що пообіцяли ми / клієнт\n- ідеї\n\nМікрофон — диктуй, текст допишеться сам."} />
            <div className="mt-foot mono">{state || "Зберігається само кожні кілька секунд"} · Esc або «Готово» — закрити</div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
