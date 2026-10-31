import Link from "next/link";
import SubmitButton from "@/components/SubmitButton";
import VoiceTextarea from "@/components/VoiceTextarea";
import { fmtDate } from "@/lib/dates";
import { CANVAS, FLOW, listStartups, STAGES } from "@/lib/repo/startups";
import { captureIdeaAction, createStartupAction, deleteStartupAction, promoteIdeaAction } from "./actions";

export const dynamic = "force-dynamic";

const ago = (iso: string | null) => {
  if (!iso) return "";
  const d = Math.floor((Date.now() - +new Date(iso.replace(" ", "T") + "Z")) / 86400_000);
  return d <= 0 ? "сьогодні" : d === 1 ? "вчора" : `${d} дн. тому`;
};

export default async function StartupsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const sp = await searchParams;
  const all = listStartups();
  const raw = all.filter((s) => s.stage === "raw");
  const projects = all.filter((s) => s.stage !== "raw");

  return (
    <div className="su">
      <div className="head">
        <div>
          <h1>Стартапи</h1>
          <div className="hub-sub">Твої продукти — від ідеї в душі до системи, що працює. Джері знає, хто ти і що ми вміємо.</div>
        </div>
      </div>

      {/* Скринька ідей: записати за 5 секунд */}
      <form action={captureIdeaAction} className="card su-capture" data-nodraft>
        <div className="su-capture-head">
          <b>Що спало на думку?</b>
          <span>Просто надиктуй як є — у скриньку. Розгорнемо з Джері, коли буде час.</span>
        </div>
        <VoiceTextarea name="text" required placeholder="Напр.: CRM для забудовників — квартири, бронювання, шахматка, ліди з реклами одразу в угоду…" style={{ minHeight: "5.5rem" }} />
        <div className="inline" style={{ flexWrap: "wrap" }}>
          <SubmitButton pendingText="Зберігаю…">У скриньку</SubmitButton>
          {sp.saved && <span className="su-saved">Збережено ✓</span>}
        </div>
      </form>

      {raw.length > 0 && (
        <section className="su-section">
          <div className="su-section-head"><h2>Скринька ідей</h2><span>{raw.length}</span></div>
          <div className="su-raw">
            {raw.map((s) => (
              <div key={s.id} className="card su-raw-card">
                <p>{s.raw_text || s.name}</p>
                <div className="su-raw-foot">
                  <span>{fmtDate(s.created_at)}</span>
                  <form action={promoteIdeaAction}><input type="hidden" name="id" value={s.id} /><SubmitButton className="small" pendingText="…">Розгорнути з Джері →</SubmitButton></form>
                  <form action={deleteStartupAction}><input type="hidden" name="id" value={s.id} /><button className="ghost small">Прибрати</button></form>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="su-section">
        <div className="su-section-head">
          <h2>Проєкти</h2>
          <details className="su-new">
            <summary>+ Новий проєкт</summary>
            <form action={createStartupAction} className="stack" style={{ marginTop: "0.75rem" }}>
              <input name="name" placeholder="Назва (робоча)" required />
              <input name="one_liner" placeholder="Одним реченням: що це і для кого" />
              <SubmitButton className="small">Створити</SubmitButton>
            </form>
          </details>
        </div>
        {projects.length === 0 ? (
          <div className="empty card">Поки нема проєктів. Запиши ідею вище і натисни «Розгорнути», або перенеси рішення з Лабораторії («Будуємо самі»).</div>
        ) : (
          <div className="su-grid">
            {projects.map((s) => {
              const filled = CANVAS.filter((c) => s.canvas[c.k]?.trim()).length;
              const idx = FLOW.indexOf(s.stage);
              const stage = STAGES.find((x) => x.k === s.stage)!;
              const dim = s.stage === "paused" || s.stage === "closed";
              return (
                <Link key={s.id} href={`/startups/${s.id}`} className={`card su-card ${dim ? "dim" : ""}`}>
                  <div className="su-card-head">
                    <b>{s.name}</b>
                    {s.prod_url && <span className={`su-dot ${s.health === 1 ? "ok" : s.health === 0 ? "bad" : ""}`} title={s.health === 1 ? "сайт працює" : s.health === 0 ? "сайт не відповідає" : "ще не перевіряли"} />}
                  </div>
                  {s.one_liner && <p className="su-card-line">{s.one_liner}</p>}
                  <div className="su-flow">
                    {FLOW.map((f, i) => <i key={f} className={i < idx ? "done" : i === idx ? "on" : ""} title={STAGES.find((x) => x.k === f)!.label} />)}
                  </div>
                  <div className="su-card-meta">
                    <span className={`tag ${dim ? "" : "accent"}`}>{stage.label}</span>
                    <span>фундамент {filled}/{CANVAS.length}</span>
                    {(s.open_tasks + s.done_tasks) > 0 && <span>задачі {s.done_tasks}/{s.open_tasks + s.done_tasks}</span>}
                    <span className="grow" />
                    <span>{ago(s.last_activity)}</span>
                  </div>
                  {s.next_step && <div className="su-card-next"><span>Далі:</span> {s.next_step}</div>}
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
