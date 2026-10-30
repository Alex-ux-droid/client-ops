import Link from "next/link";
import { notFound } from "next/navigation";
import Markdown from "@/components/Markdown";
import SubmitButton from "@/components/SubmitButton";
import { fmtDate } from "@/lib/dates";
import { getKb, kbCategories } from "@/lib/repo/kb";
import { deleteKbAction, saveKbAction } from "../actions";

export const dynamic = "force-dynamic";

// Стаття бази знань: перегляд або редагування (?edit=1); /kb/new — нова
export default async function KbArticlePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ edit?: string }> }) {
  const { id } = await params;
  const isNew = id === "new";
  const a = isNew ? undefined : getKb(Number(id));
  if (!isNew && !a) notFound();
  const editing = isNew || (await searchParams).edit === "1";
  const cats = kbCategories();

  if (editing) {
    return (
      <form action={saveKbAction} className="stack kb-article" style={{ gap: "1rem" }}>
        <Link href={a ? `/kb/${a.id}` : "/kb"} className="h-link">← {a ? "Назад до статті" : "База знань"}</Link>
        <h1>{a ? "Редагування" : "Нова стаття"}</h1>
        {a && <input type="hidden" name="id" value={a.id} />}
        <div className="form-grid">
          <div className="field"><label htmlFor="title">Назва</label><input id="title" name="title" defaultValue={a?.title} required placeholder="Напр.: Meta Ads — оновити токен" /></div>
          <div className="field">
            <label htmlFor="category">Розділ</label>
            <input id="category" name="category" defaultValue={a?.category ?? "Інструкції"} list="kb-cats" />
            <datalist id="kb-cats">{cats.map((c) => <option key={c} value={c} />)}</datalist>
          </div>
        </div>
        <div className="field">
          <label htmlFor="body_md">Текст</label>
          <textarea id="body_md" name="body_md" defaultValue={a?.body_md} style={{ minHeight: "24rem", fontSize: "0.9375rem", lineHeight: 1.55 }}
            placeholder={"# Коли робити\n- …\n\n# Кроки\n1. …\n2. …\n\n# Підводні камені\n- …"} />
          <div className="mono" style={{ color: "var(--dim)", marginTop: "0.375rem" }}># заголовок · 1. крок · - пункт · **жирне** · `код` · посилання як є</div>
        </div>
        <div className="inline"><SubmitButton /></div>
      </form>
    );
  }

  return (
    <article className="kb-article stack" style={{ gap: "1rem" }}>
      <Link href="/kb" className="h-link">← База знань</Link>
      <div className="head" style={{ marginBottom: 0 }}>
        <div>
          <div className="kicker">{a!.category}</div>
          <h1>{a!.title}</h1>
          <div className="mono" style={{ color: "var(--dim)" }}>оновлено {fmtDate(a!.updated_at)}</div>
        </div>
        <Link href={`/kb/${a!.id}?edit=1`} className="btn ghost">Редагувати</Link>
      </div>
      <div className="card"><Markdown md={a!.body_md} /></div>
      <details className="danger-zone">
        <summary>Видалити статтю</summary>
        <form action={deleteKbAction} style={{ marginTop: "0.75rem" }}><input type="hidden" name="id" value={a!.id} /><button className="ghost small">Так, видалити</button></form>
      </details>
    </article>
  );
}
