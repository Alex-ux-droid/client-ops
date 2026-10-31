import Link from "next/link";
import { notFound } from "next/navigation";
import { saveNextStep } from "@/app/actions";
import { money } from "@/lib/config";
import { fmtDate } from "@/lib/dates";
import { STAGE_LABEL, STATUS_LABEL, STATUS_TAG } from "@/lib/labels";
import { accountsForClient, kyivDay, totals } from "@/lib/repo/meta";
import { clientFlags, getClientRow } from "@/lib/repo/clients";
import { listPayments } from "@/lib/repo/payments";
import { listServices } from "@/lib/repo/services";
import { SERVICES, type ServiceType } from "@/lib/services";
import FilesTab from "./FilesTab";
import AccessTab from "./AccessTab";
import MailTab from "./MailTab";
import TelegramTab from "./TelegramTab";
import { googleConnected } from "@/lib/google";
import Overview from "./Overview";
import SetupTab from "./SetupTab";
import { clientSections } from "./sections";
import ServiceTab from "./ServiceTab";
import { HistoryTab, MaterialsTab, MoneyTab, PlaybooksTab, TasksTab } from "./tabs";


export default async function ClientPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; new?: string; m?: string; err?: string; sent?: string; edit?: string; saved?: string; q?: string; n?: string; mv?: string }> }) {
  const id = Number((await params).id);
  const c = getClientRow(id);
  if (!c) notFound();
  const sp = await searchParams;
  const services = listServices(id);
  const google = googleConnected();
  const tabs = clientSections(c, services);
  const tab = tabs.find((t) => t.k === sp.tab)?.k ?? "overview";
  const service = services.find((s) => s.type === tab);
  const flags = clientFlags(c);
  const payments = listPayments({ clientId: id });
  const paidTotal = payments.filter((p) => p.paid_at).reduce((s, p) => s + p.amount, 0);
  // ціна ліда за 7 днів — з Meta (ручні періоди більше не ведемо)
  const metaAcc = accountsForClient(id);
  const w7 = metaAcc.length ? totals(id, kyivDay(6), kyivDay(0)) : null;
  const cplText = w7?.leads ? `${(w7.spend / w7.leads).toLocaleString("uk-UA", { maximumFractionDigits: 2 })} ${metaAcc[0].currency}` : null;
  const subtitle = [c.owner_name, c.niche, c.city].filter(Boolean).join(" · ");

  return (
    <>
      {/* Повна шапка з цифрами — тільки на «Огляді»; на інших вкладках компактний рядок, решта місця під роботу */}
      {tab !== "overview" ? (
        <div className="hub-compact phone-only">
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

      </div>
      )}

      {/* На телефоні — вкладки; на компʼютері навігація в лівій панелі (ClientNav) */}
      <nav className="subnav hub-tabs phone-only">
        {tabs.map((t) => (
          <Link key={t.k} href={`/clients/${id}?tab=${t.k}`} className={`${t.k === tab ? "on" : ""} ${t.svc ? "svc" : ""}`} scroll={false}>
            {t.k === "setup" ? "Налаштування" : t.svc ? SERVICES[t.k as ServiceType].short : t.label}{t.badge ? <b>{t.badge}</b> : null}
          </Link>
        ))}
      </nav>
      {tab !== "overview" && <h1 className="desk-only section-title">{tabs.find((t) => t.k === tab)?.label}</h1>}

      {tab === "overview" && <Overview c={c} services={services} paidTotal={paidTotal} isNew={sp.new === "1"} cplText={cplText} />}
      {tab === "setup" && <SetupTab c={c} services={services} />}
      {service && <ServiceTab clientId={id} service={service} edit={sp.edit === "1"} saved={sp.saved === "1"} mv={sp.mv} err={sp.err} />}
      {tab === "tasks" && <TasksTab id={id} />}
      {tab === "history" && <HistoryTab id={id} />}
      {tab === "money" && <MoneyTab id={id} fee={c.fee_monthly} payDay={c.pay_day} paidTotal={paidTotal} />}
      {tab === "access" && <AccessTab clientId={id} err={sp.err} />}
      {tab === "files" && <FilesTab clientId={id} driveUrl={c.drive_url} google={google} err={sp.err} />}
      {tab === "telegram" && <TelegramTab clientId={id} q={sp.q} n={sp.n} />}
      {tab === "mail" && <MailTab clientId={id} email={c.email} open={sp.m} err={sp.err} sent={sp.sent === "1"} />}
      {tab === "materials" && <MaterialsTab id={id} />}
      {tab === "playbooks" && <PlaybooksTab id={id} />}
    </>
  );
}
