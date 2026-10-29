import Link from "next/link";
import SubmitButton from "@/components/SubmitButton";
import { fmtDate } from "@/lib/dates";
import { listClients } from "@/lib/repo/clients";
import { LAB_CATEGORIES, listLab } from "@/lib/repo/lab";
import { createLabAction } from "./actions";

export const dynamic = "force-dynamic";

// Лабораторія: одне робоче місце для підбору рішень клієнтам (яку CRM, телефонію, сайт; готове чи своє)
export default async function LabPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const sp = await searchParams;
  const sessions = listLab();
  const clients = listClients().filter((c) => c.status !== "archived");
  const open = sessions.filter((s) => s.status === "open");
  const done = sessions.filter((s) => s.status === "done");

  return (
    <>
      <div className="head">
        <div>
          <h1>Лабораторія</h1>
          <div className="row-sub">Підбираємо рішення клієнту: порівнюємо варіанти, тестуємо, оцінюємо — висновок іде в картку.</div>
        </div>
      </div>

      <form action={createLabAction} className="card stack" style={{ marginBottom: "1.5rem" }}>
        <h2>Нова сесія</h2>
        <div className="form-grid lab-new">
          <div className="field">
            <label htmlFor="client_id">Клієнт</label>
            <select id="client_id" name="client_id" defaultValue={sp.client ?? ""}>
              <option value="">— без клієнта —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="category">Що підбираємо</label>
            <select id="category" name="category" defaultValue="crm">
              {Object.entries(LAB_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div className="field wide">
            <label htmlFor="title">Питання</label>
            <input id="title" name="title" placeholder="Яку CRM поставити: готову чи зробити свою?" />
          </div>
          <div className="field wide">
            <label htmlFor="brief">Що треба клієнту, бюджет, обмеження</label>
            <textarea id="brief" name="brief" placeholder="5 менеджерів, ліди з Facebook і сайту, бюджет до 50$/міс, потрібна телефонія…" />
          </div>
        </div>
        <div><SubmitButton>Почати</SubmitButton></div>
      </form>

      <h2 style={{ marginBottom: "0.75rem" }}>В роботі</h2>
      <SessionList items={open} empty="Поки нема відкритих сесій." />
      {done.length > 0 && (
        <>
          <h2 style={{ margin: "1.5rem 0 0.75rem" }}>Завершені</h2>
          <SessionList items={done} empty="" />
        </>
      )}
    </>
  );
}

function SessionList({ items, empty }: { items: ReturnType<typeof listLab>; empty: string }) {
  return (
    <div className="list">
      {items.length ? items.map((s) => (
        <Link key={s.id} href={`/lab/${s.id}`} className="row">
          <div className="row-main">
            <div className="row-title">{s.title}</div>
            <div className="meta">
              <span className="tag accent">{LAB_CATEGORIES[s.category]?.label ?? s.category}</span>
              {s.client_name && <span className="tag">{s.client_name}</span>}
              <span className="mono">{s.options_count} варіант(и) · {fmtDate(s.created_at)}</span>
            </div>
          </div>
        </Link>
      )) : <div className="empty">{empty}</div>}
    </div>
  );
}
