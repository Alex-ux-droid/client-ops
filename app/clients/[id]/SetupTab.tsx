import Link from "next/link";
import { enableServiceAction } from "@/app/actions";
import type { ClientRow } from "@/lib/repo/clients";
import type { ClientService } from "@/lib/repo/services";
import { chatsForClient } from "@/lib/repo/telegram";
import { SERVICE_TYPES, SERVICES, type ServiceType } from "@/lib/services";
import { googleConnected } from "@/lib/google";

const GROUPS = ["Реклама", "Сайт і продажі", "Команда"] as const;
const STATUS_TXT = { active: "ведемо", paused: "пауза", done: "завершено" } as const;

// Налаштування клієнта: які послуги ведемо (кожна = розділ), дані, звʼязок
export default function SetupTab({ c, services }: { c: ClientRow; services: ClientService[] }) {
  const id = c.id;
  const on = new Map(services.map((s) => [s.type, s]));
  const chats = chatsForClient(id);
  return (
    <div className="stack" style={{ gap: "1.75rem" }}>
      <section>
        <h2 style={{ marginBottom: "0.375rem" }}>Послуги</h2>
        <div className="mono" style={{ color: "var(--dim)", marginBottom: "0.75rem" }}>Що ти робиш цьому клієнту. Кожна увімкнена послуга — окремий розділ зліва.</div>
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

      <section className="grid2">
        <div className="card stack">
          <h2>Дані клієнта</h2>
          <div className="mono" style={{ color: "var(--dim)" }}>Власник, контакти, бюджет, бачення, оплата, Bitwarden.</div>
          <div><Link href={`/clients/${id}/edit`} className="btn ghost">Редагувати дані</Link></div>
        </div>
        <div className="card stack">
          <h2>Звʼязок</h2>
          <div className="mono">
            Telegram: {chats.length ? <b>{chats.map((x) => x.title).join(", ")}</b> : <>група не привʼязана — <Link href="/settings?tab=connectors&c=telegram" className="h-link">привʼязати</Link></>}
          </div>
          <div className="mono">
            Пошта: {c.email
              ? googleConnected() ? <b>{c.email}</b> : <>{c.email} · Google не підключений</>
              : <>email не вказаний — розділ «Пошта» зʼявиться, коли додаси його в <Link href={`/clients/${id}/edit`} className="h-link">даних</Link></>}
          </div>
        </div>
      </section>
    </div>
  );
}
