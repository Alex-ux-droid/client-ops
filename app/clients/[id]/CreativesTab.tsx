// Студія креативів клієнта: 1) «Хто ми» в новий чат → 2) промпт креативу з кодом CR-N → 3) витяжка назад.
// Дошка Ідеї → Зроблено → У рекламі → Підсумок; цифри підтягуються з Meta за кодом у назві оголошення.
import { CopyText } from "@/app/startups/[id]/CopyText";
import { creativeRulesAction, promptUpdateAction } from "@/app/creatives/actions";
import Icon from "@/components/Icon";
import ListPop from "@/components/ListPop";
import DataTable from "@/components/DataTable";
import EditBlock from "@/components/EditBlock";
import Pop from "@/components/Pop";
import SubmitButton from "@/components/SubmitButton";
import { money } from "@/lib/config";
import { FORMATS } from "@/lib/creativeLab";
import { getBrand } from "@/lib/repo/brand";
import { adBook, creativeBrief, creativeNums, syncCodes, VERDICT, type CreativeNums } from "@/lib/creativeStudio";
import { fmtDate } from "@/lib/dates";
import { adIdsOf, codeOf, CREATIVE_STATUS, listPrompts, type CreativePrompt, type CreativeStatus } from "@/lib/repo/creatives";
import { getAnalysis } from "@/lib/repo/meta";
import CreativeGen from "./CreativeGen";
import CreativeImport from "./CreativeImport";

const COL_ICO: Record<CreativeStatus, string> = { idea: "sparkles", ready: "check", live: "megaphone", done: "flag" };

export default function CreativesTab({ clientId }: { clientId: number }) {
  syncCodes(clientId);
  const book = adBook(clientId);
  const list = listPrompts(clientId, 300).map((p) => ({ p, n: creativeNums(p, book) }));
  const brief = creativeBrief(clientId);
  const bb = getBrand(clientId);
  const brand = bb.notes, rules = bb.rules, offer = bb.offer;
  const linked = new Set(list.flatMap((x) => adIdsOf(x.p)));
  const noCode = book.ads.filter((a) => book.life(a).spend > 0 && !linked.has(a.ad_id));
  const rated = book.ads.map((a) => ({ a, ...book.life(a) })).filter((x) => x.leads > 0).sort((x, y) => x.spend / x.leads - y.spend / y.leads);
  const patterns = (getAnalysis(clientId)?.data?.patterns ?? []) as string[];
  const wins = list.filter((x) => x.n.verdict === "win"), loses = list.filter((x) => x.n.verdict === "lose");
  const hid = <input type="hidden" name="client_id" value={clientId} />;
  const last = list[0];
  const line = (x: { p: CreativePrompt; n: CreativeNums }) => `${codeOf(x.p)} ${x.p.title}${x.n.leads ? ` — ${x.n.leads} лідів по ${money(x.n.cpl)}` : ""}`;

  return (
    <div className="stack cs" style={{ gap: "1rem" }}>
      <div className="cs-flow">
        <div className="card cs-step">
          <div className="cs-sh"><span className="cs-ico"><Icon name="users" /></span><div><b>Контекст клієнта</b><small>1-ше повідомлення в новий чат Claude</small></div></div>
          <div className="cs-chips">
            <span className={offer ? "ok" : "miss"}>{offer ? "✓" : "!"} Оффер</span>
            <span className={brand ? "ok" : ""}>{brand ? "✓" : "–"} Стиль</span>
            <span className={rules ? "ok" : ""}>{rules ? "✓" : "–"} Правила</span>
            <span className={rated.length ? "ok" : ""}>{rated.length ? `✓ ${Math.min(5, rated.length)} найкращих` : "– Цифр Meta нема"}</span>
          </div>
          <div className="cs-act">
            <CopyText text={brief} label="Скопіювати" className="small" />
            <Pop wide className="pop-trigger pop-inline" title="Контекст клієнта" sub="Що Джері кладе в перше повідомлення. Клікни блок, щоб змінити." trigger={<span className="btn ghost small">Налаштувати</span>}>
              <div className="stack" style={{ gap: "0.75rem" }}>
                <div className="eb-grid">
                  <EditBlock title="Що рекламуємо" name="offer" value={offer} list action={creativeRulesAction} hidden={hid} hint="Продукт, оффер, ціни, переваги, адреса — по пункту в рядку" />
                  <EditBlock title="Візуальний стиль" name="brand" value={brand} list action={creativeRulesAction} hidden={hid} hint="Тон, настрій; кольори і шрифти — у розділі «Бренд»" />
                  <EditBlock title="Правила" name="rules" value={rules} list action={creativeRulesAction} hidden={hid} hint="Що обовʼязково і що заборонено" />
                </div>
                <div className="inline" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
                  <a href={`/clients/${clientId}?tab=brand`} className="h-link">Брендбук: кольори, шрифти, логотипи →</a>
                  <CopyText text={brief} label="Скопіювати контекст" className="small" />
                </div>
              </div>
            </Pop>
          </div>
        </div>
        <div className="card cs-step">
          <div className="cs-sh"><span className="cs-ico"><Icon name="sparkles" /></span><div><b>Промпт креативу</b><small>2-ге повідомлення в той самий чат</small></div></div>
          {last ? <span className="cs-last"><span className="cs-code">{codeOf(last.p)}</span>{last.p.title}</span> : <span className="cs-last mono">Ще жодного — склади перший</span>}
          <div className="cs-act">
            <Pop wide className="pop-trigger pop-inline" title="Новий креатив" sub="Джері пише завдання з цифр реклами під формат і кут." trigger={<span className="btn small">+ Новий промпт</span>}>
              <CreativeGen clientId={clientId} formats={FORMATS} />
            </Pop>
            {last && <CopyText text={last.p.prompt} label={`Копіювати ${codeOf(last.p)}`} />}
          </div>
        </div>
        <div className="card cs-step">
          <div className="cs-sh"><span className="cs-ico"><Icon name="check" /></span><div><b>Результат назад</b><small>Відповідь Claude з кінця чату</small></div></div>
          <span className="cs-last mono">Креатив переїде в «Зроблено», а з кодом у назві оголошення — сам у «У рекламі».</span>
          <div className="cs-act">
            <Pop wide className="pop-trigger pop-inline" title="Результат з чату" sub="Скопіюй останнє повідомлення Claude (блок з кодом CR-N) і встав." trigger={<span className="btn ghost small">Вставити результат</span>}>
              <CreativeImport clientId={clientId} />
            </Pop>
          </div>
        </div>
      </div>

      <div className="qt-grid">
        <ListPop title="Переможці" ico="sparkles" tone="good" items={wins.map(line)} empty="Ще нема — потрібні ліди на креативах з кодом" />
        <ListPop title="Програли" ico="alert" tone="bad" items={loses.map(line)} empty="Нема" />
        <Pop wide className="pop-card qt" title="Усі оголошення — за весь час" trigger={
          <>
            <span className="qt-h"><span className="qt-t"><span className="qt-ico"><Icon name="flag" /></span><b>Усі оголошення</b></span><span className="qt-n">{book.ads.length}</span></span>
            {rated.length ? rated.slice(0, 2).map((x) => <span key={x.a.ad_id} className="qt-l">{x.a.name} — {money(x.spend / x.leads)} за лід</span>) : <span className="qt-l mono">Цифр ще нема</span>}
            {book.ads.length > 0 && <span className="qt-more">таблиця →</span>}
          </>
        }>
          <DataTable id="creative-ads" cols={[
            { id: "name", label: "Оголошення", w: 280, pin: true }, { id: "code", label: "Креатив", w: 100 }, { id: "kind", label: "Тип", w: 110 },
            { id: "spend", label: "Витрати", num: true }, { id: "leads", label: "Ліди", num: true, w: 90 }, { id: "cpl", label: "Ціна ліда", num: true },
            { id: "rel", label: "До середньої", num: true, w: 130 }, { id: "ctr", label: "CTR 30 дн.", num: true, w: 110 }, { id: "status", label: "Статус", w: 110, hide: true },
          ]} rows={book.ads.map((a) => { const l = book.life(a); const cpl = l.leads ? l.spend / l.leads : null; const rel = cpl != null && book.avgCpl ? cpl / book.avgCpl : null; const cr = list.find((x) => adIdsOf(x.p).includes(a.ad_id)); return { key: a.ad_id, cells: {
            name: a.name, code: cr ? codeOf(cr.p) : null, kind: a.kind || null,
            spend: { v: l.spend, t: money(l.spend) }, leads: l.leads, cpl: { v: cpl, t: cpl == null ? "—" : money(cpl) },
            rel: { v: rel, t: rel == null ? "—" : `${Math.round(rel * 100)}%`, tone: rel == null ? undefined : rel <= 0.8 ? "good" : rel >= 1.3 ? "bad" : undefined },
            ctr: { v: a.impressions_30d ? (a.clicks_30d / a.impressions_30d) * 100 : null, t: a.impressions_30d ? `${((a.clicks_30d / a.impressions_30d) * 100).toFixed(2)}%` : "—" },
            status: a.status,
          } }; })} empty="Оголошень ще нема" />
        </Pop>
        {patterns.length > 0 && <ListPop title="Патерни" ico="layers" tone="accent" items={patterns} />}
        {noCode.length > 0 && <ListPop title="Оголошення без коду" ico="link" items={noCode.map((a) => `${a.name} — ${money(book.life(a).spend)}`)} />}
      </div>

      <div className="cs-board">
        {(Object.keys(CREATIVE_STATUS) as CreativeStatus[]).map((st) => {
          const col = list.filter((x) => (x.p.status || "idea") === st);
          return (
            <section key={st} className={`cs-col cs-${st}`}>
              <div className="cs-colh"><span className="qt-ico"><Icon name={COL_ICO[st]} /></span><b>{CREATIVE_STATUS[st]}</b><span className="qt-n">{col.length}</span></div>
              {col.length ? col.map((x) => <Card key={x.p.id} {...x} book={book} />) : <p className="mono cs-empty">{st === "idea" ? "Склади перший промпт ↑" : "Порожньо"}</p>}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Card({ p, n, book }: { p: CreativePrompt; n: CreativeNums; book: ReturnType<typeof adBook> }) {
  const v = n.verdict ? VERDICT[n.verdict] : null;
  const ids = adIdsOf(p);
  return (
    <Pop wide className="pop-card cs-card" title={`${codeOf(p)} · ${p.title}`} sub={`${p.format} · ${fmtDate(p.created_at)}`} trigger={
      <>
        <span className="cs-top"><span className="cs-code">{codeOf(p)}</span>{v && <span className={`tag ${v.tone}`}>{v.label}</span>}</span>
        <b className="cs-title">{p.title}</b>
        <span className="cs-fmt">{p.format}</span>
        {n.ads.length > 0 && <span className="cs-nums">{n.leads} лідів · {n.cpl == null ? "—" : money(n.cpl)} за лід</span>}
      </>
    }>
      <div className="stack" style={{ gap: "0.75rem" }}>
        {p.angle && <p style={{ margin: 0 }}><b>Кут:</b> {p.angle}</p>}
        <div className="inline" style={{ flexWrap: "wrap" }}>
          <CopyText text={p.prompt} label="Скопіювати промпт" className="small" />
          {p.file_url && <a href={p.file_url} target="_blank" rel="noreferrer" className="btn ghost small">Файл ↗</a>}
        </div>
        {n.ads.length > 0 && (
          <div className="cs-stat">
            <span><b>{n.leads}</b> лідів</span><span><b>{money(n.spend)}</b> витрачено</span><span><b>{n.cpl == null ? "—" : money(n.cpl)}</b> за лід</span>
            {book.avgCpl != null && <span>середня в кабінеті <b>{money(book.avgCpl)}</b></span>}
            {n.auto && p.verdict && <span className="mono">авто: {VERDICT[n.auto as keyof typeof VERDICT]?.label}</span>}
          </div>
        )}
        {p.result && <div className="cs-res"><b>Що зробили</b><p>{p.result.replace(/\[\/?CLIENT-OPS[^\]]*\]/g, "").trim()}</p></div>}
        <form action={promptUpdateAction} className="stack" style={{ gap: "0.5rem" }}>
          <input type="hidden" name="prompt_id" value={p.id} />
          <div className="mk-form">
            <select name="status" defaultValue={p.status || "idea"} aria-label="Стан">{Object.entries(CREATIVE_STATUS).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>
            <select name="verdict" defaultValue={p.verdict} aria-label="Вердикт"><option value="">{n.auto ? `Авто: ${VERDICT[n.auto as keyof typeof VERDICT].label}` : "Вердикт: авто"}</option><option value="win">виграв</option><option value="lose">програв</option></select>
            <input name="file_url" defaultValue={p.file_url} placeholder="Посилання на файл (Диск)" className="wide" />
            <input name="notes" defaultValue={p.notes} placeholder="Нотатка: що змінив, чому" className="wide" />
          </div>
          {book.ads.length > 0 && (
            <details>
              <summary className="h-link">Оголошення цього креативу ({ids.length}) — або впиши {codeOf(p)} у назву в Meta</summary>
              <div className="stack" style={{ gap: "0.25rem", marginTop: "0.5rem" }}>
                <input type="hidden" name="ad_ids" value="" />
                {book.ads.map((a) => <label key={a.ad_id} className="lp-check"><input type="checkbox" name="ad_ids" value={a.ad_id} defaultChecked={ids.includes(a.ad_id)} /> {a.name}</label>)}
              </div>
            </details>
          )}
          <div className="inline">
            <SubmitButton className="small">Зберегти</SubmitButton>
            <button name="delete" value="1" className="ghost small danger-text">Видалити</button>
          </div>
        </form>
      </div>
    </Pop>
  );
}
