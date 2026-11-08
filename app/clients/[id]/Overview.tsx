import Link from "next/link";
import NorthStar from "./NorthStar";
import { saveIdea } from "@/app/actions";
import AskAssistant from "@/components/AskAssistant";
import TaskItem from "@/components/TaskItem";
import { money } from "@/lib/config";
import { fmtDate } from "@/lib/dates";
import { earnText, type ClientRow } from "@/lib/repo/clients";
import { listIdeas } from "@/lib/repo/ideas";
import { getStrategy } from "@/lib/repo/strategy";
import type { ClientService } from "@/lib/repo/services";
import { listTasks } from "@/lib/repo/tasks";
import { clientMessages } from "@/lib/repo/telegram";
import { listWork } from "@/lib/repo/worklog";
import { SERVICES, type ServiceType } from "@/lib/services";
import Markdown from "@/components/Markdown";
import Pop from "@/components/Pop";
import Icon from "@/components/Icon";
import { BrandDot } from "@/components/Brand";
import { accountsForClient, kyivDay, totals } from "@/lib/repo/meta";
import { getCrmLink } from "@/lib/repo/crm";
import { crmStats } from "@/lib/crm";
import { clientProducts } from "@/lib/repo/products";
import ExtractButton from "@/components/ExtractButton";
import SubmitButton from "@/components/SubmitButton";
import VoiceTextarea from "@/components/VoiceTextarea";
import { getClientMemory } from "@/lib/repo/clientMemory";
import { saveClientMemoryAction } from "@/app/creatives/actions";
import MeetingNote from "@/components/MeetingNote";
import { listMeetings } from "@/lib/repo/meetings";
import { meetingStatusAction } from "@/app/meetings/actions";

const STATUS_TXT = { active: "ведемо", paused: "пауза", done: "завершено" } as const;

// Огляд клієнта: за хвилину зрозуміти, де ми, куди йдемо, що в роботі і що вже зроблено
export default function Overview({ c, services, paidTotal, isNew, cplText }: { c: ClientRow; services: ClientService[]; paidTotal: number; isNew: boolean; cplText: string | null }) {
  const id = c.id;
  const allTasks = listTasks("all", id);
  const tasks = allTasks.slice(0, 4);
  const today = new Date().toLocaleString("sv-SE", { timeZone: "Europe/Kyiv" }).slice(0, 10);
  const overdue = allTasks.filter((t) => t.due_date && t.due_date < today).length;
  const work = listWork(id, 4);
  const ideas = listIdeas({ clientId: id, status: "new" }).slice(0, 12);
  const meta = accountsForClient(id).length ? totals(id, kyivDay(6), kyivDay(0)) : null;
  const sales = getCrmLink(id) ? crmStats(id, new Date(Date.now() - 30 * 86400_000).toISOString()) : null;
  const prods = clientProducts(id);
  const tg = clientMessages(id, { limit: 4 });
  const st = getStrategy(id);
  const lastTg = tg.at(-1)?.sent_at ?? null;

  return (
    <div className="stack" style={{ gap: "1.5rem" }}>
      {isNew && (
        <div className="callout">
          <b>Клієнта створено.</b> Відкрий <Link href={`/clients/${id}?tab=setup`} className="h-link">Налаштування клієнта</Link> і обери послуги — кожна стане окремим розділом. Решту можна надиктувати Джері.
        </div>
      )}

      <NorthStar clientId={id} />

      {/* Цифри одним рядком: клік — у потрібний розділ */}
      <div className="ov-kpis">
        <Link href={`/clients/${id}?tab=money`} className="kpi-tile">
          <div className="kpi-label"><Icon name="wallet" size={15} /> Гроші</div>
          <div className="kpi-value" style={{ color: c.debt ? "var(--bad)" : "var(--ok)" }}>{c.debt ? money(c.debt) : c.fee_monthly ? money(c.fee_monthly) : c.revenue_model !== "retainer" && c.share_percent ? `${c.share_percent}%` : "—"}</div>
          <div className="kpi-sub">{c.debt ? "борг · " : ""}{earnText(c, money)} · всього {money(paidTotal)}</div>
        </Link>
        <Link href={`/clients/${id}?tab=meta_ads`} className="kpi-tile">
          <div className="kpi-label"><BrandDot text="Meta" size={13} /> Реклама · 7 дн.</div>
          <div className="kpi-value">{meta ? meta.leads : "—"}<small> {meta ? "лідів" : ""}</small></div>
          <div className="kpi-sub">{meta ? `ціна ліда ${cplText ?? "—"} · витрачено ${Math.round(meta.spend)}` : "кабінет не привʼязано"}</div>
        </Link>
        <Link href={`/clients/${id}?tab=sales`} className="kpi-tile">
          <div className="kpi-label"><Icon name="zap" size={15} /> Продажі · 30 дн.</div>
          <div className="kpi-value" style={{ color: sales?.sales ? "var(--ok)" : undefined }}>{sales ? sales.sales : "—"}<small> {sales ? "продажів" : ""}</small></div>
          <div className="kpi-sub">{sales ? `на ${Math.round(sales.revenue).toLocaleString("uk-UA")} ${sales.currency} · ${sales.leads} лідів` : "CRM не підключена"}</div>
        </Link>
        <Link href={`/clients/${id}?tab=tasks`} className="kpi-tile">
          <div className="kpi-label"><Icon name="tasks" size={15} /> Задачі</div>
          <div className="kpi-value" style={{ color: overdue ? "var(--bad)" : undefined }}>{allTasks.length}<small> в роботі</small></div>
          <div className="kpi-sub">{overdue ? `${overdue} прострочено` : "без прострочок"}{c.last_work ? ` · робота ${fmtDate(c.last_work)}` : ""}</div>
        </Link>
      </div>

      {/* Де ми: стратегія + що памʼятає Джері */}
      <div className="ov-where">
        <Pop className="pop-card ov-tile" wide title="Стратегія клієнта" trigger={
          <>
            <span className="qt-h"><span className="qt-t"><span className="qt-ico"><Icon name="compass" /></span><b>Стратегія</b></span></span>
            {st.where_now || st.goal || st.focus ? <>
              {st.focus && <span className="ov-line"><em>Фокус</em>{st.focus.split("\n")[0]}</span>}
              {st.where_now && <span className="ov-line"><em>Де ми</em>{st.where_now.split("\n")[0]}</span>}
              {st.goal && <span className="ov-line"><em>Куди</em>{st.goal.split("\n")[0]}</span>}
            </> : <span className="qt-l mono">ще порожньо — відкрий і заповни</span>}
          </>
        }>
          {st.focus && <><b>Головне зараз</b><p style={{ whiteSpace: "pre-wrap" }}>{st.focus}</p></>}
          {st.where_now && <><b>Де ми</b><p style={{ whiteSpace: "pre-wrap" }}>{st.where_now}</p></>}
          {st.goal && <><b>Куди йдемо</b><p style={{ whiteSpace: "pre-wrap" }}>{st.goal}</p></>}
          {(c.my_vision || c.needs || c.client_vision) && <><b>Бачення</b><p style={{ whiteSpace: "pre-wrap" }}>{[c.my_vision && `Моє: ${c.my_vision}`, (c.needs || c.client_vision) && `Клієнт хоче: ${c.needs || c.client_vision}`].filter(Boolean).join("\n")}</p></>}
          <Link href={`/clients/${id}?tab=strategy`} className="btn small">Відкрити стратегію →</Link>
        </Pop>
        <ClientMemoryCard clientId={id} clientName={c.name} />
      </div>

      <div className="qt-grid">
        <Meetings clientId={id} clientName={c.name} />
        <Pop className="pop-card qt" title="Послуги" trigger={<><span className="qt-h"><span className="qt-t"><span className="qt-ico"><Icon name="zap" /></span><b>Послуги</b></span><span className="qt-n">{services.length}</span></span>
          {services.length ? <span className="qt-marks">{services.slice(0, 6).map((s) => <span key={s.type} className="tag accent">{SERVICES[s.type as ServiceType].short}</span>)}</span> : <span className="qt-l mono">обрати →</span>}</>}>
          <div className="stack" style={{ gap: "0.5rem" }}>
            {services.map((s) => <Link key={s.type} href={`/clients/${id}?tab=${s.type}`} className="inline h-link"><BrandDot text={`${SERVICES[s.type as ServiceType].label} ${s.tool_name ?? ""}`} size={16} />{SERVICES[s.type as ServiceType].label}{s.tool_name ? ` · ${s.tool_name}` : ""}{s.status !== "active" ? ` · ${STATUS_TXT[s.status]}` : ""}</Link>)}
            <Link href={`/clients/${id}?tab=setup`} className="btn ghost small">Налаштувати послуги</Link>
          </div>
        </Pop>
        <Pop className="pop-card qt" title="Наші продукти в клієнта" trigger={<><span className="qt-h"><span className="qt-t"><span className="qt-ico"><Icon name="box" /></span><b>Наші продукти</b></span><span className="qt-n">{prods.length}</span></span>
          {prods.length ? prods.slice(0, 2).map((p) => <span key={p.id} className="qt-l">{p.name}</span>) : <span className="qt-l mono">ще не привʼязано</span>}</>}>
          <div className="stack" style={{ gap: "0.5rem" }}>
            {prods.length ? prods.map((p) => <Link key={p.id} href={`/products/${p.id}`} className="h-link">{p.name}{p.note ? ` · ${p.note}` : ""}</Link>) : <p className="mono">Привʼязати клієнта можна в продукті → «Клієнти».</p>}
            <Link href="/products" className="btn ghost small">Усі продукти →</Link>
          </div>
        </Pop>
        <Pop className="pop-card qt" wide title="Останнє в Telegram" trigger={<><span className="qt-h"><span className="qt-t"><span className="qt-ico"><BrandDot text="Telegram" size={14} /></span><b>Telegram</b></span>{lastTg && <span className="qt-n">{fmtDate(lastTg)}</span>}</span>
          {tg.length ? <span className="qt-l">{tg.at(-1)!.is_owner ? "Ти" : tg.at(-1)!.from_name}: {tg.at(-1)!.text || "📎"}</span> : <span className="qt-l mono">групу не привʼязано</span>}</>}>
          <div className="list">{tg.map((m) => <div key={m.id} className="row"><div className="row-main"><div className="mono">{m.is_owner ? "Ти" : m.from_name} · {fmtDate(m.sent_at)} {m.sent_at.slice(11, 16)}</div><div className="row-title" style={{ fontWeight: 400 }}>{m.text || (m.kind === "voice" ? "🎙 голосове" : "📎 вкладення")}</div></div></div>)}</div>
          <Link href={`/clients/${id}?tab=telegram`} className="btn ghost small" style={{ marginTop: "0.75rem" }}>Вся переписка →</Link>
        </Pop>
        <Pop className="pop-card qt" title="Ідеї для клієнта" trigger={<><span className="qt-h"><span className="qt-t"><span className="qt-ico"><Icon name="bulb" /></span><b>Ідеї</b></span><span className="qt-n">{ideas.length}</span></span>
          {ideas.length ? ideas.slice(0, 2).map((i) => <span key={i.id} className="qt-l">{i.text}</span>) : <span className="qt-l mono">додати →</span>}</>}>
          <form action={saveIdea} className="inline" style={{ marginBottom: "0.75rem" }}>
            <input type="hidden" name="client_id" value={id} />
            <input name="text" placeholder="Ідея для клієнта…" required aria-label="Ідея" />
            <button>Додати</button>
          </form>
          <ul className="st-list">{ideas.map((i) => <li key={i.id}>{i.text}</li>)}</ul>
        </Pop>
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

      <div className="ov-extract">
        <ExtractButton scope={`клієнт «${c.name}» (client_id ${id})`} kind="client" id={id} />
        <AskAssistant text="Коротко, як другу: де ми зараз з цим клієнтом, що горить, що наступне і на що звернути увагу.">Джері, де ми з клієнтом?</AskAssistant>
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

// Що Джері памʼятає про клієнта: де ми, домовленості, зроблене, далі. Від цього він планує, а не з нуля.
function ClientMemoryCard({ clientId }: { clientId: number; clientName: string }) {
  const mem = getClientMemory(clientId);
  const plain = (mem?.text ?? "").replace(/\*\*/g, "").split("\n").map((x) => x.replace(/^[\s#>*•-]+/, "").trim()).filter(Boolean);
  return (
    <Pop className="pop-card ov-tile" wide title="Що Джері памʼятає про клієнта" sub={mem ? `оновлено ${fmtDate(mem.updated_at)} · сам після розмов` : "ще порожньо"} trigger={
      <>
        <span className="qt-h"><span className="qt-t"><span className="qt-ico"><Icon name="bot" /></span><b>Памʼять Джері</b></span>{mem && <span className="qt-n">{fmtDate(mem.updated_at)}</span>}</span>
        {plain.length ? <span className="pv-s l2">{plain.at(-1)}</span> : <span className="qt-l mono">ще порожньо — відкрий і натисни «Зібрати»</span>}
        <span className="qt-more">повністю — Стратегія → Хроніка</span>
      </>
    }>
      {mem?.text ? <div className="tm-details"><Markdown md={mem.text} /></div> : <p className="mono">Розкажи Джері, де ви з клієнтом (зустріч, домовленості, що вже зроблено) — або «Зібрати»: він збере з історії, задач і переписки.</p>}
      <div className="inline" style={{ flexWrap: "wrap", margin: "0.75rem 0" }}>
        <AskAssistant text={`Клієнт client_id ${clientId}: збери памʼять по клієнту з усього, що є (історія робіт, задачі, переписка в групі, заявки, стратегія, наші розмови) і запиши client_memory rewrite: де ми зараз, домовленості (гроші, обсяг, терміни), що вже зроблено, що в роботі і далі, що важливо. Потім коротко покажи мені.`}>Джері, зібрати / оновити</AskAssistant>
      </div>
      <details>
        <summary className="h-link">Правити руками</summary>
        <form action={saveClientMemoryAction} className="stack" style={{ gap: "0.5rem", marginTop: "0.5rem" }}>
          <input type="hidden" name="client_id" value={clientId} />
          <VoiceTextarea name="text" defaultValue={mem?.text ?? "## Де ми зараз\n\n## Домовленості (гроші, обсяг, терміни)\n\n## Що вже зроблено\n\n## Що в роботі і далі\n\n## Важливо памʼятати\n"} style={{ minHeight: "12rem" }} />
          <div><SubmitButton className="small">Зберегти</SubmitButton></div>
        </form>
      </details>
    </Pop>
  );
}

// Зустрічі з клієнтом: тези (кнопка «Зустріч» / «Записати зустріч»), розбір з Джері
function Meetings({ clientId, clientName }: { clientId: number; clientName: string }) {
  const ms = listMeetings(clientId, 20);
  const fresh = ms.filter((m) => m.status === "new");
  return (
    <Pop wide className={`pop-card qt${fresh.length ? " qt-accent" : ""}`} title="Зустрічі" trigger={<><span className="qt-h"><span className="qt-t"><span className="qt-ico"><Icon name="mic" /></span><b>Зустрічі</b></span><span className="qt-n">{fresh.length ? `${fresh.length} нерозібр.` : ms.length}</span></span>
      {ms.length ? ms.slice(0, 2).map((m) => <span key={m.id} className="qt-l">{m.status === "new" ? "● " : ""}{m.title || "Зустріч"}{m.title.includes(fmtDate(m.created_at)) ? "" : ` · ${fmtDate(m.created_at)}`}</span>) : <span className="qt-l mono">записати тези під час зустрічі →</span>}</>}>
      <div className="stack" style={{ gap: "0.75rem" }}>
        <div><MeetingNote clientId={clientId} clientName={clientName} label="Нова зустріч" className="btn small" /></div>
        {ms.length ? ms.map((m) => (
          <div key={m.id} className={`card stack mt-item${m.status === "new" ? " new" : ""}`} style={{ gap: "0.5rem" }}>
            <div className="inline" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
              <b>{m.title || "Зустріч"}</b>
              <span className="mono">{fmtDate(m.created_at)} · {m.status === "new" ? "не розібрано" : "розібрано"}</span>
            </div>
            <Markdown md={m.notes || "_порожньо_"} />
            <div className="inline" style={{ flexWrap: "wrap" }}>
              {m.status === "new" && <AskAssistant text={`Розбери зустріч з клієнтом «${clientName}» (meetings, meeting_id ${m.id}): що зрозуміли про клієнта і його задачі → допиши памʼять клієнта (client_memory: домовленості, гроші, терміни), нові кроки → задачі без дублів, ідеї → ідеї клієнта. Потім познач зустріч розібраною (meetings done). Коротко скажи, що записав.`}>Розібрати з Джері</AskAssistant>}
              <MeetingNote clientId={clientId} clientName={clientName} meeting={{ id: m.id, title: m.title, notes: m.notes }} label="Дописати" className="btn ghost small" />
              <form action={meetingStatusAction}><input type="hidden" name="meeting_id" value={m.id} /><button name="op" value={m.status === "new" ? "done" : "reopen"} className="ghost small">{m.status === "new" ? "Розібрано ✓" : "Повернути в нерозібрані"}</button></form>
              <form action={meetingStatusAction}><input type="hidden" name="meeting_id" value={m.id} /><button name="op" value="delete" className="ghost small danger-text">Видалити</button></form>
            </div>
          </div>
        )) : <p className="mono">Ще нема. Під час зустрічі тисни «Зустріч» — пиши або диктуй тези, зберігається само.</p>}
      </div>
    </Pop>
  );
}
