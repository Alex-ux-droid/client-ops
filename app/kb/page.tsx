import Link from "next/link";
import AskAssistant from "@/components/AskAssistant";
import { fmtDate } from "@/lib/dates";
import { listKb } from "@/lib/repo/kb";

export const dynamic = "force-dynamic";

// База знань: інструкції і робочі нотатки — щоб наступного разу не згадувати заново
export default async function KbPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const items = listKb(q);
  const groups = [...new Set(items.map((a) => a.category))];
  return (
    <>
      <div className="head">
        <div>
          <h1>База знань</h1>
          <div className="row-sub">Інструкції і нотатки: як підключити, як налаштувати, що де лежить. Джері теж сюди пише і звідси читає.</div>
        </div>
        <div className="inline">
          <AskAssistant text="Запиши в базу знань інструкцію по тому, що ми щойно робили: кроки, підводні камені, що перевірити.">Джері, запиши</AskAssistant>
          <Link href="/kb/new" className="btn">+ Нова</Link>
        </div>
      </div>
      <form className="inline" style={{ marginBottom: "1.25rem" }}>
        <input name="q" defaultValue={q} placeholder="Пошук по базі знань…" aria-label="Пошук" />
        <button className="ghost">Знайти</button>
      </form>
      {!items.length && <div className="empty card">{q ? "Нічого не знайшов." : "Поки порожньо."}</div>}
      {groups.map((g) => (
        <section key={g} style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ marginBottom: "0.75rem" }}>{g}</h2>
          <div className="list kb-list">
            {items.filter((a) => a.category === g).map((a) => (
              <Link key={a.id} href={`/kb/${a.id}`} className="row">
                <div className="row-main">
                  <div className="row-title">{a.title}</div>
                  <div className="mono">оновлено {fmtDate(a.updated_at)}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
