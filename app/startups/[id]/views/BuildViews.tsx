// «Будинок» продукту: база знань (що ламалось і як виправили, API, уроки з поля) і журнал проблем, які шле сам продукт.
import { headers } from "next/headers";
import AskAssistant from "@/components/AskAssistant";
import Markdown from "@/components/Markdown";
import SubmitButton from "@/components/SubmitButton";
import VoiceTextarea from "@/components/VoiceTextarea";
import { fmtDate } from "@/lib/dates";
import { KNOWLEDGE_CATS, type Startup, type StartupItem } from "@/lib/repo/startups";
import { ISSUE_KINDS, ISSUE_STATUS, listIssues } from "@/lib/repo/startupIssues";
import { integrationPrompt, issuePrompt } from "@/lib/startupIssues";
import { addItemAction, deleteItemAction, issueAction } from "../../actions";
import { CopyText } from "../CopyText";

export function KnowledgeView({ s, items }: { s: Startup; items: StartupItem[] }) {
  const kn = items.filter((i) => i.kind === "knowledge").reverse();
  return (
    <div className="stack" style={{ gap: "1rem" }}>
      <div className="lab-section-head">
        <p className="lab-muted" style={{ margin: 0 }}>Памʼять проєкту: що ламалось і як виправили, як підключали API (Binotel, Zadarma…), уроки з відділу продажу. Йде в ТЗ для Claude Code і Джері — щоб наступний раз будувати швидше і міцніше.</p>
        <AskAssistant text={`Стартап startup_id ${s.id}: перечитай наші останні розмови, рішення і закриті проблеми — і запиши в базу знань (startup_item kind knowledge, data.cat fix|integration|lesson|field, data.fix — як вирішили) усе важливе, чого там ще нема. Коротко скажи, що додав.`}>Джері, допиши знання</AskAssistant>
      </div>
      <form action={addItemAction} className="card mk-form">
        <input type="hidden" name="id" value={s.id} /><input type="hidden" name="kind" value="knowledge" /><input type="hidden" name="v" value="kb" />
        <select name="d_cat" defaultValue="fix" aria-label="Тип">{Object.entries(KNOWLEDGE_CATS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <input name="title" required placeholder="Коротко: напр. «Binotel не віддає запис дзвінка одразу»" />
        <div className="wide"><VoiceTextarea name="body" placeholder="Що сталось / як влаштовано / що побачили в людей" style={{ minHeight: "4rem" }} /></div>
        <div className="wide"><VoiceTextarea name="d_fix" placeholder="Рішення: як виправили / як правильно робити" style={{ minHeight: "3rem" }} /></div>
        <div className="wide"><SubmitButton className="small">Записати в базу знань</SubmitButton></div>
      </form>
      {kn.length ? Object.entries(KNOWLEDGE_CATS).map(([k, label]) => {
        const xs = kn.filter((i) => (i.data.cat || "lesson") === k);
        if (!xs.length) return null;
        return (
          <section key={k} className="stack" style={{ gap: "0.5rem" }}>
            <h3 className="su-kb-h">{label} <span className="lab-muted">{xs.length}</span></h3>
            {xs.map((i) => (
              <details key={i.id} id={`i-${i.id}`} className="card su-kb">
                <summary><b>{i.title}</b><span className="lab-muted"> · {fmtDate(i.created_at)}</span></summary>
                {i.body && <div className="su-muted-p"><Markdown md={i.body} /></div>}
                {i.data.fix && <div className="md-note"><p><b>Рішення:</b> {i.data.fix}</p></div>}
                {i.data.issue_id && <p className="lab-muted">з проблеми #{i.data.issue_id}</p>}
                <form action={deleteItemAction}><input type="hidden" name="item_id" value={i.id} /><input type="hidden" name="v" value="kb" /><button className="ghost small">Прибрати</button></form>
              </details>
            ))}
          </section>
        );
      }) : <div className="empty card">Ще порожньо. Записуй сюди кожну складну річ, яку розібрали — це і є «міцний каркас» продукту.</div>}
    </div>
  );
}

export async function IssuesView({ s }: { s: Startup }) {
  const list = listIssues(s.id);
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host") ?? ""}`;
  const open = list.filter((i) => i.status === "new" || i.status === "work");
  const closed = list.filter((i) => i.status === "fixed" || i.status === "ignored");
  const row = (i: (typeof list)[number]) => (
    <details key={i.id} id={`iss-${i.id}`} className={`card su-iss ${i.status}`} open={i.status === "new"}>
      <summary>
        <span className={`tag ${i.status === "new" ? "bad" : i.status === "work" ? "warn" : "ok"}`}>{ISSUE_STATUS[i.status]}</span>
        <b>{i.title}</b>
        <span className="lab-muted">{ISSUE_KINDS[i.kind]}{i.count > 1 ? ` · ×${i.count}` : ""} · {fmtDate(i.last_at)}</span>
      </summary>
      {i.url && <p className="lab-muted">Де: {i.url}</p>}
      {i.reporter && <p className="lab-muted">Від: {i.reporter}</p>}
      {i.details && <pre className="su-iss-pre">{i.details}</pre>}
      {i.fix_note && <div className="md-note"><p><b>Як виправили:</b> {i.fix_note}</p></div>}
      <div className="inline" style={{ flexWrap: "wrap" }}>
        <CopyText text={issuePrompt(s, i)} label="Промпт для Claude Code" />
        {i.status === "new" && <form action={issueAction}><input type="hidden" name="issue_id" value={i.id} /><input type="hidden" name="status" value="work" /><button className="ghost small">Беру в роботу</button></form>}
        {i.status !== "ignored" && i.status !== "fixed" && <form action={issueAction}><input type="hidden" name="issue_id" value={i.id} /><input type="hidden" name="status" value="ignored" /><button className="ghost small">Ігнор</button></form>}
        {(i.status === "fixed" || i.status === "ignored") && <form action={issueAction}><input type="hidden" name="issue_id" value={i.id} /><input type="hidden" name="status" value="new" /><button className="ghost small">Відкрити знову</button></form>}
      </div>
      {i.status !== "fixed" && (
        <form action={issueAction} className="stack" style={{ gap: "0.5rem" }}>
          <input type="hidden" name="issue_id" value={i.id} /><input type="hidden" name="status" value="fixed" />
          <VoiceTextarea name="fix_note" placeholder="Як виправили (коротко) — піде в базу знань" style={{ minHeight: "3rem" }} />
          <label className="lp-check"><input type="checkbox" name="to_kb" defaultChecked /> Записати в базу знань</label>
          <div><button className="small">✓ Виправлено</button></div>
        </form>
      )}
    </details>
  );
  return (
    <div className="stack" style={{ gap: "1rem" }}>
      <p className="lab-muted" style={{ margin: 0 }}>Сюди продукт сам надсилає помилки і відгуки користувачів (кнопка «Щось не працює»). Беремо проблему → «Промпт для Claude Code» → виправили → «Виправлено» з поясненням → воно лягає в базу знань.</p>
      {open.length ? <div className="stack" style={{ gap: "0.5rem" }}>{open.map(row)}</div> : <div className="empty card">Відкритих проблем нема.</div>}
      {closed.length > 0 && <details className="stack"><summary className="h-link">Закриті ({closed.length})</summary><div className="stack" style={{ gap: "0.5rem", marginTop: "0.5rem" }}>{closed.map(row)}</div></details>}
      <details className="card">
        <summary><b>Підключити продукт до журналу</b> <span className="lab-muted">— один раз, через Claude Code</span></summary>
        <div className="stack" style={{ gap: "0.5rem", marginTop: "0.75rem" }}>
          <p className="lab-muted" style={{ margin: 0 }}>Скопіюй промпт і встав у Claude Code в репозиторії продукту — він додасть автоматичні звіти про помилки і кнопку «Щось не працює». У промпті є ключ проєкту: не публікуй його.</p>
          <CopyText text={integrationPrompt(s, origin)} label="Промпт: підключити звіти" />
        </div>
      </details>
    </div>
  );
}
