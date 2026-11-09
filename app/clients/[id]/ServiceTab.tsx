import { removeServiceAction, saveServiceAction } from "@/app/actions";
import Link from "next/link";
import SubmitButton from "@/components/SubmitButton";
import { money } from "@/lib/config";
import { fmtDate } from "@/lib/dates";
import { listFolders, listTools, type ClientService } from "@/lib/repo/services";
import { serviceDef, type ServiceType } from "@/lib/services";
import { accountsForClient } from "@/lib/repo/meta";
import MetaLive from "./MetaLive";
import CampaignsView from "./campaigns/CampaignsView";
import FormsView from "./campaigns/FormsView";
import Pop from "@/components/Pop";
import Icon from "@/components/Icon";
import VoiceTextarea from "@/components/VoiceTextarea";
import { hasPassport, listPItems, nextUpdateVer, productUpdates, serviceProduct } from "@/lib/repo/products";
import { ProductImport, ProductPrompt } from "@/app/products/ProductClient";
import { startServiceDevAction } from "@/app/products/actions";

// Послуги, які ми «будуємо» — у них свій паспорт розвитку (промпт → витяжка → оновлення → ідеї)
const DEV_TYPES = new Set(["website", "crm", "automation", "telephony"]);

const STATUS = [
  { v: "active", label: "Ведемо зараз" },
  { v: "paused", label: "На паузі" },
  { v: "done", label: "Завершено" },
] as const;

// Вкладка однієї послуги: налаштування, інструмент, поля, папка; для реклами — цифри по періодах
export default function ServiceTab({ clientId, service, edit, saved, mv, err, cmp, sel, form, mp }: { clientId: number; service: ClientService; edit: boolean; saved: boolean; mv?: string; err?: string; cmp?: string; sel?: string; form?: string; mp?: string }) {
  const type = service.type as ServiceType;
  const def = serviceDef(type);
  const tools = def.tool ? listTools(def.tool.category) : [];
  const folder = def.folder ? listFolders(clientId).find((f) => f.kind === def.folder) : undefined;
  const links = [
    type === "website" && service.details.url && { href: service.details.url, label: "Відкрити сайт" },
    type === "website" && service.details.repo && { href: service.details.repo, label: "GitHub" },
    service.details.admin_url && { href: service.details.admin_url, label: "Адмінка" },
    type === "crm" && service.details.url && { href: service.details.url, label: "Відкрити CRM" },
    folder?.url && { href: folder.url, label: `Папка «${folder.title}»` },
  ].filter(Boolean) as { href: string; label: string }[];
  // Порожня послуга — одразу форма; заповнена — гарний перегляд, форма по кнопці «Редагувати»
  const filled = !!(service.tool_id || service.started_at || service.notes || Object.values(service.details).some(Boolean));
  // Meta з привʼязаним кабінетом: спершу живі цифри, анкета — по кнопці «Редагувати»
  const live = type === "meta_ads" && accountsForClient(clientId).length > 0;
  const editing = edit || (!filled && !live);
  // на підвкладках Meta (структура, креативи…) анкету не показуємо — тільки на «Огляді»
  const showForm = mv !== "campaigns" && mv !== "forms" && (!live || !mv || mv === "overview");

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

      {live && <MetaLive clientId={clientId} view={mv} err={err} cmp={cmp} sel={sel} form={form} mp={mp} />}
      {/* Без привʼязаного кабінету конструктор кампаній теж працює */}
      {type === "meta_ads" && !live && (mv === "campaigns" ? <CampaignsView clientId={clientId} cmp={cmp} sel={sel} err={err} /> : mv === "forms" ? <FormsView clientId={clientId} form={form} />
        : <div className="card kp-promo"><div><b>Конструктор кампаній</b><span className="mono">Готуєш кампанію тут — групи, таргетинг, оголошення з креативом і текстами від Джері — і копіюєш у Ads Manager.</span></div><Link href={`/clients/${clientId}?tab=meta_ads&mv=campaigns`} className="btn small">Відкрити →</Link></div>)}

      {DEV_TYPES.has(type) && <ServiceDev clientId={clientId} type={type} label={def.label} />}

      {showForm && (
        <>
      {/* key: після збереження форма перемальовується зі свіжими значеннями */}
      {editing ? (
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
                  ? <VoiceTextarea id={`d_${f.key}`} name={`d_${f.key}`} defaultValue={service.details[f.key] ?? ""} placeholder={f.placeholder} />
                  : <input id={`d_${f.key}`} name={`d_${f.key}`} type="text" inputMode={f.type === "number" ? "decimal" : f.type === "url" ? "url" : undefined} autoCapitalize={f.type === "url" ? "off" : undefined}
                      defaultValue={service.details[f.key] ?? ""} placeholder={f.placeholder} />}
              </div>
            ))}
            <div className="field wide">
              <label htmlFor="notes">Нотатки</label>
              <VoiceTextarea id="notes" name="notes" defaultValue={service.notes} placeholder="Домовленості, нюанси, що не забути" />
            </div>
          </div>
          <div className="inline">
            <SubmitButton />
            {filled && <Link href={`/clients/${clientId}?tab=${type}`} className="btn ghost" scroll={false}>Скасувати</Link>}
          </div>
        </form>
      ) : (
        live ? (
          <div className="qt-grid">
            <Pop className="pop-card qt" wide title={`Анкета послуги · ${def.label}`} trigger={<><span className="qt-h"><span className="qt-t"><span className="qt-ico"><Icon name="file" /></span><b>Анкета послуги</b></span></span><span className="qt-l">{service.tool_name || def.hint}</span><span className="qt-more">відкрити →</span></>}>
              <ServiceView service={service} type={type} clientId={clientId} saved={saved} />
            </Pop>
          </div>
        ) : <ServiceView service={service} type={type} clientId={clientId} saved={saved} />
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
        </>
      )}
    </div>
  );
}

const STATUS_TAG: Record<string, string> = { active: "ok", paused: "warn", done: "" };

// Перегляд послуги: ключові факти плиткою, довгі тексти — блоками
function ServiceView({ service, type, clientId, saved }: { service: ClientService; type: ServiceType; clientId: number; saved: boolean }) {
  const def = serviceDef(type);
  const d = service.details;
  const show = (f: (typeof def.fields)[number]) => {
    const v = d[f.key];
    if (f.type === "url") return <a href={v} target="_blank" rel="noreferrer" className="h-link">{v.replace(/^https?:\/\//, "").replace(/\/$/, "")} ↗</a>;
    if (f.type === "date") return fmtDate(v);
    if (f.type === "number" && f.key === "budget" && !isNaN(Number(v))) return money(Number(v));
    return v;
  };
  const facts = [
    def.tool && service.tool_name && { label: def.tool.label, value: <b>{service.tool_name}</b> },
    def.builtWith && { label: "Робимо в", value: <b>{def.builtWith}</b> },
    service.started_at && { label: "Працюємо з", value: fmtDate(service.started_at) },
    ...def.fields.filter((f) => f.type !== "textarea" && d[f.key]).map((f) => ({ label: f.label, value: show(f) })),
  ].filter(Boolean) as { label: string; value: React.ReactNode }[];
  const texts = def.fields.filter((f) => f.type === "textarea" && d[f.key]);
  const empty = def.fields.filter((f) => !d[f.key]);

  return (
    <div className="card stack svc-view">
      <div className="svc-view-top">
        <span className={`tag ${STATUS_TAG[service.status] ?? ""}`}>{STATUS.find((x) => x.v === service.status)?.label}</span>
        {saved && <span className="tag ok">Збережено ✓</span>}
        <span className="grow" />
        <Link href={`/clients/${clientId}?tab=${type}&edit=1`} className="btn ghost small" scroll={false}>Редагувати</Link>
      </div>
      {facts.length > 0 && (
        <div className="facts">
          {facts.map((f) => (
            <div key={f.label} className="fact">
              <div className="fact-label">{f.label}</div>
              <div className="fact-value">{f.value}</div>
            </div>
          ))}
        </div>
      )}
      {texts.map((f) => (
        <div key={f.key} className="svc-text">
          <h3>{f.label}</h3>
          <p>{d[f.key]}</p>
        </div>
      ))}
      {service.notes && (
        <div className="svc-text">
          <h3>Нотатки</h3>
          <p>{service.notes}</p>
        </div>
      )}
      {empty.length > 0 && (
        <div className="mono" style={{ color: "var(--dim)" }}>
          Ще не заповнено: {empty.map((f) => f.label.toLowerCase()).join(", ")}.{" "}
          <Link href={`/clients/${clientId}?tab=${type}&edit=1`} className="h-link" scroll={false}>Додати</Link>
        </div>
      )}
    </div>
  );
}

// Розвиток послуги: промпт у чат Claude, де робимо систему клієнта → витяжка назад → хронологія, фічі, ідеї
function ServiceDev({ clientId, type, label }: { clientId: number; type: ServiceType; label: string }) {
  const p = serviceProduct(clientId, type);
  if (!p) return (
    <form action={startServiceDevAction} className="card kp-promo">
      <input type="hidden" name="client_id" value={clientId} />
      <input type="hidden" name="type" value={type} />
      <div><b>Розвиток · {label}</b><span className="mono">Промпт у чат Claude, де робиш цю систему → повна витяжка (що зроблено, фічі, інтеграції, ідеї) → вставляєш сюди. Далі — оновлення, і все копиться.</span></div>
      <SubmitButton className="small">Почати вести розвиток</SubmitButton>
    </form>
  );
  const passport = hasPassport(p.id);
  const last = productUpdates(p.id).at(-1);
  const stopped = last?.body.match(/Де зупинились:\*\*\s*([^\n]+)/)?.[1];
  const ideas = listPItems(p.id, "idea", 50).filter((x) => !x.done);
  const feats = p.features.split("\n").map((x) => x.replace(/^[-•]\s*/, "").trim()).filter(Boolean);
  return (
    <div className="card stack sd-card">
      <div className="sd-head">
        <b>Розвиток · {label}</b>
        <span className="mono">{passport ? (last ? `${last.title.split(" — ")[0]} · ${last.created_at.slice(0, 10)}` : "Паспорт є") : "Ще нема витяжки"}</span>
        <span className="grow" />
        <Link href={`/products/${p.id}`} className="btn ghost small">Паспорт ↗</Link>
      </div>
      {passport ? (
        <>
          {p.summary && <p className="sd-sum">{p.summary}</p>}
          {(stopped || p.next_step) && <div className="mono">{stopped ? `Де зупинились: ${stopped}` : `Далі: ${p.next_step}`}</div>}
          <div className="qt-grid">
            <Pop className="pop-card qt" title={`Фічі · ${p.name}`} trigger={<><span className="qt-h"><span className="qt-t"><span className="qt-ico"><Icon name="layers" /></span><b>Що зроблено</b></span><span className="qt-n">{feats.length}</span></span><span className="qt-l">{feats.slice(0, 2).join(" · ") || "—"}</span></>}>
              <ul className="sd-list">{feats.map((f) => <li key={f}>{f}</li>)}</ul>
            </Pop>
            <Pop className="pop-card qt" title={`Ідеї розвитку · ${p.name}`} trigger={<><span className="qt-h"><span className="qt-t"><span className="qt-ico"><Icon name="sparkles" /></span><b>Ідеї розвитку</b></span><span className="qt-n">{ideas.length}</span></span><span className="qt-l">{ideas.slice(0, 2).map((x) => x.title).join(" · ") || "—"}</span></>}>
              <ul className="sd-list">{ideas.map((x) => <li key={x.id}>{x.title}</li>)}</ul>
            </Pop>
          </div>
        </>
      ) : <div className="mono">1) Скопіюй промпт → встав у чат Claude, де робиш цю систему клієнту. 2) Його відповідь (блок [CLIENT-OPS:ПРОДУКТ]) встав сюди → «Розкласти».</div>}
      <div className="inline" style={{ flexWrap: "wrap" }}>
        {passport ? <ProductPrompt productId={p.id} mode="update" label={`Промпт: оновлення ${nextUpdateVer(p.id)}`} primary /> : <ProductPrompt productId={p.id} label="Промпт: повна витяжка" primary />}
        {passport && <ProductPrompt productId={p.id} label="Повний промпт" />}
        <ProductImport productId={p.id} compact />
      </div>
    </div>
  );
}
