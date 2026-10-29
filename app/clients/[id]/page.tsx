import Link from "next/link";
import { notFound } from "next/navigation";
import { saveNextStep } from "@/app/actions";
import Chat from "@/components/Chat";
import { money } from "@/lib/config";
import { fmtDate } from "@/lib/dates";
import { STAGE_LABEL, STATUS_LABEL, STATUS_TAG } from "@/lib/labels";
import { cpl, listAdStats } from "@/lib/repo/ads";
import { listChat } from "@/lib/repo/chat";
import { clientFlags, getClientRow } from "@/lib/repo/clients";
import { listPayments } from "@/lib/repo/payments";
import { clientPlaybooks } from "@/lib/repo/playbooks";
import { listServices } from "@/lib/repo/services";
import { listTasks } from "@/lib/repo/tasks";
import { getApiKey } from "@/lib/secrets";
import { SERVICES, type ServiceType } from "@/lib/services";
import FilesTab from "./FilesTab";
import MailTab from "./MailTab";
import { googleConnected } from "@/lib/google";
import Overview from "./Overview";
import ServiceTab from "./ServiceTab";
import { HistoryTab, MaterialsTab, MoneyTab, PlaybooksTab, TasksTab } from "./tabs";

const BASE_TABS = [
  { k: "tasks", label: "Задачі" },
  { k: "history", label: "Історія" },
  { k: "money", label: "Гроші" },
  { k: "files", label: "Файли" },
  { k: "materials", label: "Матеріали" },
  { k: "playbooks", label: "Плейбуки" },
  { k: "assistant", label: "Помічник" },
];

export default async function ClientPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; new?: string; m?: string; err?: string; sent?: string; edit?: string; saved?: string }> }) {
  const id = Number((await params).id);
  const c = getClientRow(id);
  if (!c) notFound();
  const sp = await searchParams;
  const services = listServices(id);
  // Вкладки: огляд, потім по одній на кожну увімкнену послугу, потім загальні
  const google = googleConnected();
  const tabs = [
    { k: "overview", label: "Огляд" },
    ...services.map((s) => ({ k: s.type, label: SERVICES[s.type as ServiceType].short })),
    ...(google ? [{ k: "mail", label: "Пошта" }] : []),
    ...BASE_TABS,
  ];
  const tab = tabs.find((t) => t.k === sp.tab)?.k ?? "overview";
  const service = services.find((s) => s.type === tab);
  const flags = clientFlags(c);
  const tasks = listTasks("all", id);
  const payments = listPayments({ clientId: id });
  const paidTotal = payments.filter((p) => p.paid_at).reduce((s, p) => s + p.amount, 0);
  const lastAd = listAdStats(id).at(-1);
  const badge: Record<string, number> = { tasks: tasks.length, playbooks: clientPlaybooks(id).length };
  const subtitle = [c.owner_name, c.niche, c.city].filter(Boolean).join(" · ");

  return (
    <>
      {/* Повна шапка з цифрами — тільки на «Огляді»; на інших вкладках компактний рядок, решта місця під роботу */}
      {tab !== "overview" ? (
        <div className="hub-compact">
          <Link href={`/clients/${id}`} className="hub-compact-name" scroll={false}>
            <span className="kicker">Клієнт</span>
            <b>{c.name}</b>
          </Link>
          <span className={`tag ${STATUS_TAG[c.status]}`}>{STATUS_LABEL[c.status]}</span>
        </div>
      ) : (
      <div className="hub-head">
        <div className="hub-top">
          <div style={{ minWidth: 0 }}>
            <div className="kicker"><Link href="/clients">Клієнти</Link></div>
            <h1>{c.name}</h1>
            {subtitle && <div className="hub-sub">{subtitle}</div>}
            <div className="meta">
              <span className={`tag ${STATUS_TAG[c.status]}`}>{STATUS_LABEL[c.status]}{c.status === "lead" ? ` · ${STAGE_LABEL[c.stage]}` : ""}</span>
              {services.filter((s) => s.status === "active").map((s) => <Link key={s.type} href={`/clients/${id}?tab=${s.type}`} className="tag accent">{SERVICES[s.type as ServiceType].short}</Link>)}
              {flags.map((f) => <span key={f.text} className={`tag ${f.level}`}>{f.text}</span>)}
            </div>
          </div>
          <div className="hub-actions">
            {c.drive_url && <a href={c.drive_url} target="_blank" rel="noreferrer" className="btn ghost">Диск ↗</a>}
            <Link href={`/clients/${id}/edit`} className="btn ghost">Редагувати</Link>
          </div>
        </div>

        <form action={saveNextStep} className="next-step">
          <input type="hidden" name="id" value={id} />
          <span>Наступний крок</span>
          <input name="next_step" defaultValue={c.next_step} placeholder="Що робимо далі з цим клієнтом?" aria-label="Наступний крок" />
          <button className="ghost small">Ок</button>
        </form>

        <div className="kpis">
          <div className="kpi"><div className="n">{c.fee_monthly ? money(c.fee_monthly) : "—"}</div><div className="l">Платить / міс</div></div>
          <div className="kpi"><div className="n" style={{ color: c.debt ? "var(--bad)" : undefined }}>{money(c.debt)}</div><div className="l">Борг</div></div>
          <div className="kpi"><div className="n">{lastAd && cpl(lastAd) !== null ? money(cpl(lastAd)) : "—"}</div><div className="l">Ціна ліда (остання)</div></div>
          <div className="kpi"><div className="n">{c.last_work ? fmtDate(c.last_work) : "—"}</div><div className="l">Остання робота</div></div>
        </div>
      </div>
      )}

      <nav className="subnav hub-tabs">
        {tabs.map((t) => (
          <Link key={t.k} href={`/clients/${id}?tab=${t.k}`} className={`${t.k === tab ? "on" : ""} ${services.some((s) => s.type === t.k) ? "svc" : ""}`} scroll={false}>
            {t.label}{badge[t.k] ? <b>{badge[t.k]}</b> : null}
          </Link>
        ))}
      </nav>

      {tab === "overview" && <Overview c={c} services={services} paidTotal={paidTotal} isNew={sp.new === "1"} />}
      {service && <ServiceTab clientId={id} service={service} edit={sp.edit === "1"} saved={sp.saved === "1"} />}
      {tab === "assistant" && <Chat clientId={id} page="картка клієнта" initial={listChat(id)} hasKey={!!getApiKey()} />}
      {tab === "tasks" && <TasksTab id={id} />}
      {tab === "history" && <HistoryTab id={id} />}
      {tab === "money" && <MoneyTab id={id} fee={c.fee_monthly} payDay={c.pay_day} paidTotal={paidTotal} />}
      {tab === "files" && <FilesTab clientId={id} driveUrl={c.drive_url} google={google} err={sp.err} />}
      {tab === "mail" && <MailTab clientId={id} email={c.email} open={sp.m} err={sp.err} sent={sp.sent === "1"} />}
      {tab === "materials" && <MaterialsTab id={id} />}
      {tab === "playbooks" && <PlaybooksTab id={id} />}
    </>
  );
}
