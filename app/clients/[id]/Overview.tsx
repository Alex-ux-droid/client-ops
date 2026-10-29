import Link from "next/link";
import { enableServiceAction, saveIdea } from "@/app/actions";
import TaskItem from "@/components/TaskItem";
import { money } from "@/lib/config";
import { fmtDate } from "@/lib/dates";
import type { ClientRow } from "@/lib/repo/clients";
import { listIdeas } from "@/lib/repo/ideas";
import type { ClientService } from "@/lib/repo/services";
import { listTasks } from "@/lib/repo/tasks";
import { listWork } from "@/lib/repo/worklog";
import { SERVICE_TYPES, SERVICES, type ServiceType } from "@/lib/services";

const GROUPS = ["Реклама", "Сайт і продажі", "Команда"] as const;
const STATUS_TXT = { active: "ведемо", paused: "пауза", done: "завершено" } as const;

export default function Overview({ c, services, paidTotal, isNew }: { c: ClientRow; services: ClientService[]; paidTotal: number; isNew: boolean }) {
  const id = c.id;
  const tasks = listTasks("all", id).slice(0, 5);
  const work = listWork(id, 4);
  const ideas = listIdeas({ clientId: id, status: "new" });
  const on = new Map(services.map((s) => [s.type, s]));

  return (
    <div className="stack" style={{ gap: "1.75rem" }}>
      {isNew && (
        <div className="callout">
          <b>Клієнта створено.</b> Тепер обери, що ти йому робиш, — для кожної послуги відкриється своя вкладка.
          Решту можна заповнити поступово або надиктувати Джері.
        </div>
      )}

      <section>
        <h2 style={{ marginBottom: "0.75rem" }}>Послуги</h2>
        <div className="svc-groups">
          {GROUPS.map((g) => (
            <div key={g} className="svc-group">
              <div className="svc-group-title">{g}</div>
              <div className="svc-tiles">
                {SERVICE_TYPES.filter((t) => SERVICES[t].group === g).map((t: ServiceType) => {
                  const s = on.get(t);
                  const def = SERVICES[t];
                  return s ? (
                    <Link key={t} href={`/clients/${id}?tab=${t}`} className={`svc-tile on ${s.status}`}>
                      <span className="svc-tile-ico">{def.ico}</span>
                      <span className="svc-tile-txt"><b>{def.label}</b><small>{s.tool_name ?? STATUS_TXT[s.status]}</small></span>
                      <span className="svc-check">✓</span>
                    </Link>
                  ) : (
                    <form key={t} action={enableServiceAction}>
                      <input type="hidden" name="client_id" value={id} />
                      <input type="hidden" name="type" value={t} />
                      <button className="svc-tile" title={`Додати «${def.label}»`}>
                        <span className="svc-tile-ico">{def.ico}</span>
                        <span className="svc-tile-txt"><b>{def.label}</b><small>{def.hint}</small></span>
                        <span className="svc-check">+</span>
                      </button>
                    </form>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="split">
        <div className="stack" style={{ gap: "1.75rem" }}>
          <div className="grid2">
            <dl className="card kv">
              <div><dt>Що хоче клієнт</dt><dd>{c.needs}</dd></div>
              <div><dt>Бачення клієнта</dt><dd>{c.client_vision}</dd></div>
              <div><dt>Бюджет / умови</dt><dd>{c.budget}</dd></div>
            </dl>
            <dl className="card kv">
              <div><dt style={{ color: "var(--link)" }}>Моє бачення</dt><dd>{c.my_vision}</dd></div>
              <div><dt>Нотатки</dt><dd>{c.notes}</dd></div>
            </dl>
          </div>
          <div>
            <h2 style={{ marginBottom: "0.75rem", display: "flex", justifyContent: "space-between" }}>Відкриті задачі <Link href={`/clients/${id}?tab=tasks`} className="h-link">всі →</Link></h2>
            <div className="list">{tasks.length ? tasks.map((t) => <TaskItem key={t.id} t={t} showClient={false} />) : <div className="empty">Задач нема.</div>}</div>
          </div>
          <div>
            <h2 style={{ marginBottom: "0.75rem", display: "flex", justifyContent: "space-between" }}>Останні роботи <Link href={`/clients/${id}?tab=history`} className="h-link">вся історія →</Link></h2>
            <div className="list timeline">
              {work.length ? work.map((w) => (
                <div key={w.id} className="row"><div className="row-main"><div className="mono">{fmtDate(w.done_at)}</div><div className="row-title">{w.what}</div>{w.result && <div className="row-sub" style={{ color: "var(--ok)" }}>{w.result}</div>}</div></div>
              )) : <div className="empty">Ще нічого не записано.</div>}
            </div>
          </div>
        </div>
        <div className="stack" style={{ gap: "1.75rem" }}>
          <dl className="card kv">
            <div><dt>Власник</dt><dd>{c.owner_name}</dd></div>
            <div><dt>Вид бізнесу</dt><dd>{[c.niche, c.locations > 1 ? `${c.locations} точки/бізнеси` : ""].filter(Boolean).join(" · ")}</dd></div>
            <div><dt>Місто</dt><dd>{c.city}</dd></div>
            <div><dt>Телефон · пошта</dt><dd>{[c.phone, c.email].filter(Boolean).join(" · ")}</dd></div>
            <div><dt>Інші контакти</dt><dd>{c.contacts}</dd></div>
            <div><dt>Bitwarden</dt><dd>{c.bitwarden_ref}</dd></div>
            <div><dt>Ведемо з · отримано всього</dt><dd>{c.work_since ? fmtDate(c.work_since) : "—"} · {money(paidTotal)}</dd></div>
          </dl>
          <div>
            <h2 style={{ marginBottom: "0.75rem" }}>Ідеї</h2>
            <form action={saveIdea} className="inline" style={{ marginBottom: "0.5rem" }}>
              <input type="hidden" name="client_id" value={id} />
              <input name="text" placeholder="Ідея для клієнта…" required aria-label="Ідея" />
              <button>✦</button>
            </form>
            <div className="list">{ideas.length ? ideas.map((i) => <div key={i.id} className="row"><div className="row-main"><div className="row-title">{i.text}</div></div></div>) : <div className="empty">Ідей нема.</div>}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
