import { removeServiceAction, saveServiceAction } from "@/app/actions";
import { fmtDate } from "@/lib/dates";
import { listFolders, listTools, type ClientService } from "@/lib/repo/services";
import { serviceDef, type ServiceType } from "@/lib/services";
import { AdsStats } from "./tabs";

const STATUS = [
  { v: "active", label: "Ведемо зараз" },
  { v: "paused", label: "На паузі" },
  { v: "done", label: "Завершено" },
] as const;

// Вкладка однієї послуги: налаштування, інструмент, поля, папка; для реклами — цифри по періодах
export default function ServiceTab({ clientId, service }: { clientId: number; service: ClientService }) {
  const type = service.type as ServiceType;
  const def = serviceDef(type);
  const tools = def.tool ? listTools(def.tool.category) : [];
  const folder = def.folder ? listFolders(clientId).find((f) => f.kind === def.folder) : undefined;
  const links = [
    type === "website" && service.details.url && { href: service.details.url, label: "Відкрити сайт" },
    service.details.admin_url && { href: service.details.admin_url, label: "Адмінка" },
    type === "crm" && service.details.url && { href: service.details.url, label: "Відкрити CRM" },
    folder?.url && { href: folder.url, label: `Папка «${folder.title}»` },
  ].filter(Boolean) as { href: string; label: string }[];

  return (
    <div className="stack" style={{ gap: "1.5rem" }}>
      <div className="svc-head">
        <div className="svc-ico">{def.ico}</div>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ fontSize: "1.375rem" }}>{def.label}{service.tool_name ? ` · ${service.tool_name}` : ""}</h2>
          <div className="row-sub">{def.hint}{service.started_at ? ` · з ${fmtDate(service.started_at)}` : ""}</div>
        </div>
        {links.length > 0 && (
          <div className="svc-links">
            {links.map((l) => <a key={l.href + l.label} href={l.href} target="_blank" rel="noreferrer" className="btn ghost small">{l.label} ↗</a>)}
          </div>
        )}
      </div>

      {/* key: після збереження форма перемальовується зі свіжими значеннями */}
      <form key={JSON.stringify([service.status, service.started_at, service.tool_id, service.details, service.notes])} action={saveServiceAction} className="card stack">
        <input type="hidden" name="client_id" value={clientId} />
        <input type="hidden" name="type" value={type} />
        <div className="form-grid">
          <div className="field">
            <label htmlFor="status">Статус</label>
            <select id="status" name="status" defaultValue={service.status}>
              {STATUS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="started_at">З якої дати</label>
            <input id="started_at" type="date" name="started_at" defaultValue={service.started_at ?? ""} />
          </div>
          {def.tool && (
            <>
              <div className="field">
                <label htmlFor="tool_id">{def.tool.label}</label>
                <select id="tool_id" name="tool_id" defaultValue={service.tool_id ?? ""}>
                  <option value="">— обрати —</option>
                  {tools.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="new_tool">Нема в списку? Впиши назву</label>
                <input id="new_tool" name="new_tool" placeholder="додасться в довідник" />
              </div>
            </>
          )}
          {def.fields.map((f) => (
            <div key={f.key} className={`field ${f.wide || f.type === "textarea" ? "wide" : ""}`}>
              <label htmlFor={`d_${f.key}`}>{f.label}</label>
              {f.type === "textarea"
                ? <textarea id={`d_${f.key}`} name={`d_${f.key}`} defaultValue={service.details[f.key] ?? ""} placeholder={f.placeholder} />
                : <input id={`d_${f.key}`} name={`d_${f.key}`} type={f.type === "number" ? "text" : f.type} inputMode={f.type === "number" ? "decimal" : undefined}
                    defaultValue={service.details[f.key] ?? ""} placeholder={f.placeholder} />}
            </div>
          ))}
          <div className="field wide">
            <label htmlFor="notes">Нотатки</label>
            <textarea id="notes" name="notes" defaultValue={service.notes} placeholder="Домовленості, нюанси, що не забути" />
          </div>
        </div>
        <div><button>Зберегти</button></div>
      </form>

      {def.adPlatform && (
        <div>
          <h2 style={{ marginBottom: "0.75rem" }}>Цифри з кабінету</h2>
          <AdsStats id={clientId} platform={def.adPlatform} />
        </div>
      )}

      <details className="danger-zone">
        <summary>Прибрати послугу</summary>
        <form action={removeServiceAction} className="stack" style={{ marginTop: "0.75rem" }}>
          <input type="hidden" name="client_id" value={clientId} />
          <input type="hidden" name="type" value={type} />
          <div className="mono">Вкладка зникне, заповнені поля видаляться. Цифри реклами, задачі й історія лишаться. Якщо просто закінчили — постав статус «Завершено».</div>
          <div><button className="ghost small">Так, прибрати «{def.label}»</button></div>
        </form>
      </details>
    </div>
  );
}
