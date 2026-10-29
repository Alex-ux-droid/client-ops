"use client";
import Link from "next/link";
import { useState } from "react";
import { addTask, logWork, saveIdea, savePayment } from "@/app/actions";
import { ymd } from "@/lib/dates";

type Opt = { id: number; name: string };
const TABS = [
  { k: "task", label: "Задача" },
  { k: "idea", label: "Ідея" },
  { k: "work", label: "Зробив" },
  { k: "pay", label: "Оплата" },
] as const;

export default function QuickAdd({ clients, onClose }: { clients: Opt[]; onClose: () => void }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["k"]>("task");
  const submit = (fn: (fd: FormData) => Promise<void>) => async (fd: FormData) => { await fn(fd); onClose(); };
  const ClientSelect = ({ required }: { required?: boolean }) => (
    <select name="client_id" defaultValue="" required={required} aria-label="Клієнт">
      <option value="">{required ? "Клієнт…" : "Без клієнта"}</option>
      {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
    </select>
  );

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="tabs" style={{ margin: 0 }}>
            {TABS.map((t) => <button key={t.k} type="button" className={`tab-btn ${tab === t.k ? "on" : ""}`} onClick={() => setTab(t.k)}>{t.label}</button>)}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Закрити">✕</button>
        </div>

        {tab === "task" && (
          <form action={submit(addTask)} className="stack">
            <input name="title" placeholder="Що зробити" required autoFocus id="qa-task" />
            <div className="inline"><input type="date" name="due_date" defaultValue={ymd()} /><ClientSelect /></div>
            <button>Додати задачу</button>
          </form>
        )}
        {tab === "idea" && (
          <form action={submit(saveIdea)} className="stack">
            <textarea name="text" placeholder="Що спало на думку" required autoFocus id="qa-idea" />
            <ClientSelect />
            <button>Записати ідею</button>
          </form>
        )}
        {tab === "work" && (
          <form action={submit(logWork)} className="stack">
            <ClientSelect required />
            <input name="what" placeholder="Що зробив" required id="qa-what" />
            <input name="result" placeholder="Результат (необов'язково)" />
            <input type="date" name="done_at" defaultValue={ymd()} />
            <button>Записати в історію</button>
          </form>
        )}
        {tab === "pay" && (
          <form action={submit(savePayment)} className="stack">
            <ClientSelect required />
            <div className="inline">
              <input name="amount" inputMode="decimal" placeholder="Сума" required id="qa-amount" />
              <input type="date" name="due_date" defaultValue={ymd()} />
            </div>
            <label className="check-line"><input type="checkbox" name="paid" value="1" defaultChecked /> Вже отримав</label>
            <input name="note" placeholder="Коментар" />
            <button>Зберегти оплату</button>
          </form>
        )}
        <div className="modal-foot">
          <Link href="/clients/new" onClick={onClose}>+ новий клієнт</Link>
          <Link href="/playbooks/new" onClick={onClose}>+ новий плейбук</Link>
        </div>
      </div>
    </div>
  );
}
