import Link from "next/link";
import { saveIdea } from "@/app/actions";
import AskAssistant from "@/components/AskAssistant";
import TaskItem from "@/components/TaskItem";
import { money } from "@/lib/config";
import { fmtDate } from "@/lib/dates";
import type { ClientRow } from "@/lib/repo/clients";
import { listIdeas } from "@/lib/repo/ideas";
import { listLabForClient } from "@/lib/repo/lab";
import type { ClientService } from "@/lib/repo/services";
import { listTasks } from "@/lib/repo/tasks";
import { clientMessages } from "@/lib/repo/telegram";
import { listWork } from "@/lib/repo/worklog";
import { SERVICES, type ServiceType } from "@/lib/services";

const STATUS_TXT = { active: "ведемо", paused: "пауза", done: "завершено" } as const;

// Огляд клієнта: за хвилину зрозуміти, де ми, куди йдемо, що в роботі і що вже зроблено
export default function Overview({ c, services, paidTotal, isNew, cplLast }: { c: ClientRow; services: ClientService[]; paidTotal: number; isNew: boolean; cplLast: number | null }) {
  const id = c.id;
  const tasks = listTasks("all", id).slice(0, 5);
  const work = listWork(id, 5);
  const ideas = listIdeas({ clientId: id, status: "new" }).slice(0, 4);
  const tg = clientMessages(id, { limit: 4 });
  const labs = listLabForClient(id).slice(0, 3);
  const lastTg = tg.at(-1)?.sent_at ?? null;

  return (
    <div className="stack" style={{ gap: "1.5rem" }}>
      {isNew && (
        <div className="callout">
          <b>Клієнта створено.</b> Відкрий <Link href={`/clients/${id}?tab=setup`} className="h-link">Налаштування клієнта</Link> і обери послуги — кожна стане окремим розділом. Решту можна надиктувати Джері.
        </div>
      )}

      <div className="ov-now card">
        <div className="ov-now-row">
          <div className="ov-stat"><span>Послуги</span>
            <div className="meta" style={{ marginTop: 0 }}>
              {services.length
                ? services.map((s) => <Link key={s.type} href={`/clients/${id}?tab=${s.type}`} className={`tag ${s.status === "active" ? "accent" : ""}`}>{SERVICES[s.type as ServiceType].short}{s.tool_name ? ` · ${s.tool_name}` : ""}{s.status !== "active" ? ` · ${STATUS_TXT[s.status]}` : ""}</Link>)
                : <Link href={`/clients/${id}?tab=setup`} className="h-link">обрати послуги</Link>}
            </div>
          </div>
          <div className="ov-stat"><span>Остання робота</span><b>{c.last_work ? fmtDate(c.last_work) : "—"}</b></div>
          <div className="ov-stat"><span>Останнє в Telegram</span><b>{lastTg ? fmtDate(lastTg) : "—"}</b></div>
          <div className="ov-stat"><span>Ведемо з</span><b>{c.work_since ? fmtDate(c.work_since) : "—"}</b></div>
        </div>
        <div className="chips">
          <AskAssistant text="Коротко, як другу: де ми зараз з цим клієнтом, що горить, що наступне і на що звернути увагу.">Джері, де ми з клієнтом?</AskAssistant>
        </div>
      </div>

      <div className="grid2">
        <section className="card stack ov-card">
          <h2>Куди йдемо</h2>
          <dl className="kv">
            <div><dt style={{ color: "var(--link)" }}>Моє бачення</dt><dd>{c.my_vision || <span className="ov-dim">не записано</span>}</dd></div>
            <div><dt>Чого хоче клієнт</dt><dd>{c.needs || c.client_vision || <span className="ov-dim">не записано</span>}</dd></div>
            {c.client_vision && c.needs && <div><dt>Бачення клієнта</dt><dd>{c.client_vision}</dd></div>}
          </dl>
        </section>
        <section className="card stack ov-card">
          <h2>Гроші</h2>
          <div className="ov-money">
            <div><b>{c.fee_monthly ? money(c.fee_monthly) : "—"}</b><span>платить / міс</span></div>
            <div><b style={{ color: c.debt ? "var(--bad)" : undefined }}>{money(c.debt)}</b><span>борг</span></div>
            <div><b>{money(paidTotal)}</b><span>отримано всього</span></div>
            <div><b>{cplLast !== null ? money(cplLast) : "—"}</b><span>ціна ліда</span></div>
          </div>
          {c.budget && <div className="mono">Бюджет / умови: {c.budget}</div>}
        </section>
      </div>

      <div className="grid2">
        <section>
          <h2 className="ov-h">У роботі <Link href={`/clients/${id}?tab=tasks`} className="h-link">всі →</Link></h2>
          <div className="list">{tasks.length ? tasks.map((t) => <TaskItem key={t.id} t={t} showClient={false} />) : <div className="empty">Відкритих задач нема.</div>}</div>
        </section>
        <section>
          <h2 className="ov-h">Що зроблено <Link href={`/clients/${id}?tab=history`} className="h-link">історія →</Link></h2>
          <div className="list timeline">
            {work.length ? work.map((w) => (
              <div key={w.id} className="row"><div className="row-main"><div className="mono">{fmtDate(w.done_at)}</div><div className="row-title">{w.what}</div>{w.result && <div className="row-sub" style={{ color: "var(--ok)" }}>{w.result}</div>}</div></div>
            )) : <div className="empty">Ще нічого не записано.</div>}
          </div>
        </section>
      </div>

      <div className="grid2">
        {tg.length > 0 && (
          <section>
            <h2 className="ov-h">Останнє в Telegram <Link href={`/clients/${id}?tab=telegram`} className="h-link">вся переписка →</Link></h2>
            <div className="list">
              {tg.map((m) => (
                <div key={m.id} className="row"><div className="row-main">
                  <div className="mono">{m.is_owner ? "Ти" : m.from_name} · {fmtDate(m.sent_at)} {m.sent_at.slice(11, 16)}</div>
                  <div className="row-title" style={{ fontWeight: 400 }}>{m.text || (m.kind === "voice" ? "🎙 голосове" : "📎 вкладення")}</div>
                </div></div>
              ))}
            </div>
          </section>
        )}
        <section>
          <h2 className="ov-h">Ідеї</h2>
          <form action={saveIdea} className="inline" style={{ marginBottom: "0.5rem" }}>
            <input type="hidden" name="client_id" value={id} />
            <input name="text" placeholder="Ідея для клієнта…" required aria-label="Ідея" />
            <button>✦</button>
          </form>
          <div className="list">{ideas.length ? ideas.map((i) => <div key={i.id} className="row"><div className="row-main"><div className="row-title">{i.text}</div></div></div>) : <div className="empty">Ідей нема.</div>}</div>
        </section>
        {labs.length > 0 && (
          <section>
            <h2 className="ov-h">Рішення з Лабораторії</h2>
            <div className="list">{labs.map((l) => <Link key={l.id} href={`/lab/${l.id}`} className="row"><div className="row-main"><div className="row-title">{l.title}</div><div className="mono">{l.status === "done" ? "завершено" : "в роботі"} · {fmtDate(l.created_at)}</div></div></Link>)}</div>
          </section>
        )}
      </div>

      <details className="card ov-contacts">
        <summary><h2>Контакти і дані</h2></summary>
        <dl className="kv" style={{ marginTop: "0.75rem" }}>
          <div><dt>Власник</dt><dd>{c.owner_name}</dd></div>
          <div><dt>Вид бізнесу</dt><dd>{[c.niche, c.locations > 1 ? `${c.locations} точки/бізнеси` : ""].filter(Boolean).join(" · ")}</dd></div>
          <div><dt>Місто</dt><dd>{c.city}</dd></div>
          <div><dt>Телефон · пошта</dt><dd>{[c.phone, c.email].filter(Boolean).join(" · ")}</dd></div>
          <div><dt>Інші контакти</dt><dd>{c.contacts}</dd></div>
          <div><dt>Bitwarden</dt><dd>{c.bitwarden_ref}</dd></div>
          <div><dt>Нотатки</dt><dd>{c.notes}</dd></div>
        </dl>
      </details>
    </div>
  );
}
