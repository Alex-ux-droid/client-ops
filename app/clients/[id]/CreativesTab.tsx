// Студія креативів клієнта: 1) «Хто ми» в новий чат → 2) промпт креативу з кодом CR-N → 3) витяжка назад.
// Дошка Ідеї → Зроблено → У рекламі → Підсумок; цифри підтягуються з Meta за кодом у назві оголошення.
import { CopyText } from "@/app/startups/[id]/CopyText";
import { creativeRulesAction, promptUpdateAction } from "@/app/creatives/actions";
import Icon from "@/components/Icon";
import ListPop from "@/components/ListPop";
import DataTable from "@/components/DataTable";
import Pop from "@/components/Pop";
import SubmitButton from "@/components/SubmitButton";
import VoiceTextarea from "@/components/VoiceTextarea";
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
  const line = (x: { p: CreativePrompt; n: CreativeNums }) => `${codeOf(x.p)} ${x.p.title}${x.n.leads ? ` — ${x.n.leads} лідів по ${money(x.n.cpl)}` : ""}`;

  return (
    <div className="stack cs" style={{ gap: "1rem" }}>
      <div className="cs-flow">
        <div className="card cs-step">
          <div className="cs-sh"><span className="cs-n">1</span><b>Хто ми</b></div>
          <p className="mono">Контекст про клієнта: оффер, бренд, що дало дешеві ліди, що провалилось, правила. Перше повідомлення в новий чат Claude.</p>
          <div className="inline" style={{ flexWrap: "wrap" }}>
            <CopyText text={brief} label="Скопіювати «Хто ми»" className="small" />
            <Pop wide title="Хто ми — контекст для нового чату" trigger={<span className="h-link">Оффер, бренд, правила</span>}>
              <form action={creativeRulesAction} className="stack" style={{ gap: "0.5rem" }}>
                <input type="hidden" name="client_id" value={clientId} />
                <label className="mono">Що рекламуємо: продукт, оффер, ціни, переваги, адреса</label>
                <VoiceTextarea name="offer" defaultValue={offer} placeholder={"Імплантація під ключ від $450, гарантія 10 років\nКлініка на Позняках, парковка\nПерша консультація + КТ безкоштовно"} style={{ minHeight: "5rem" }} />
                <label className="mono">Візуальний стиль (кольори і шрифти — у розділі «Бренд»)</label>
                <VoiceTextarea name="brand" defaultValue={brand} placeholder={"Кольори: #0e3b2e, золотий акцент\nШрифт: строгий без засічок\nТон: преміально, спокійно, без «акцій»"} style={{ minHeight: "5rem" }} />
                <label className="mono">Правила: що обовʼязково і що заборонено</label>
                <VoiceTextarea name="rules" defaultValue={rules} placeholder={"Обовʼязково: адреса ЖК, «від забудовника»\nЗаборонено: слово «знижка», стокові фото людей"} style={{ minHeight: "5rem" }} />
                <div className="inline"><SubmitButton className="small">Зберегти</SubmitButton><a href={`/clients/${clientId}?tab=brand`} className="h-link">Повний брендбук → кольори, шрифти, логотипи</a></div>
              </form>
              <pre className="su-iss-pre cs-brief">{brief}</pre>
            </Pop>
          </div>
          <span className="cs-meta">{rated.length ? `${Math.min(5, rated.length)} найкращих оголошень у контексті` : "Цифр з Meta ще нема"} · {offer ? "оффер ✓" : <b className="cs-miss">оффер не заповнений</b>} · {brand ? "бренд ✓" : "бренд порожній"} · {rules ? "правила ✓" : "правил нема"}</span>
        </div>
        <div className="card cs-step">
          <div className="cs-sh"><span className="cs-n">2</span><b>Новий креатив</b></div>
          <p className="mono">Джері пише завдання з даних реклами під формат і кут. Друге повідомлення в той самий чат.</p>
          <CreativeGen clientId={clientId} formats={FORMATS} />
        </div>
        <div className="card cs-step">
          <div className="cs-sh"><span className="cs-n">3</span><b>Витяжка назад</b></div>
          <p className="mono">Наприкінці чату Claude дасть блок з кодом CR-N — встав сюди. Код впиши і в назву оголошення в Meta.</p>
          <CreativeImport clientId={clientId} />
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
        {p.result && <details open><summary className="h-link">Що зробили (витяжка)</summary><pre className="su-iss-pre">{p.result}</pre></details>}
        <details><summary className="h-link">Промпт повністю</summary><pre className="su-iss-pre">{p.prompt}</pre></details>
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
