// Конструктор кампаній Meta (клієнт → Meta Ads → «Кампанії»): готуємо кампанію тут, копіюємо в Ads Manager,
// після запуску бачимо цифри (код AD-N у назві оголошення) і записуємо, що зайшло — Джері на цьому вчиться.
import Link from "next/link";
import {
  adOpAction, addAdsetAction, attachFormAction, adsetOpAction, createCampaignAction, deleteCampaignAction, deleteNoteAction, duplicateCampaignAction,
  mediaFromMetaAction, noteAction, saveAdAction, saveAdsetAction, saveCampaignAction, saveCardAction, savePlanAction,
} from "@/app/campaigns/actions";
import EditBlock from "@/components/EditBlock";
import Icon from "@/components/Icon";
import Pop from "@/components/Pop";
import SubmitButton from "@/components/SubmitButton";
import VoiceTextarea from "@/components/VoiceTextarea";
import { adLive, adPromptFull, adUrl, campaignFolderName, fileNameFor, formMd, adsetTargeting, campaignChatPrompt, campaignChecks, campaignLive, campaignMd, LIMITS, money2, syncCampaign, type LiveNums } from "@/lib/campaigns";
import { creativeBrief } from "@/lib/creativeStudio";
import { fmtDate } from "@/lib/dates";
import {
  AD_FORMATS, AD_STATUS, adCode, CM_STATUS, CARD_LIMITS, CREATIVE_TOOLS, cardsOf, cardTextsOf, getForm, listForms, parseQuestions, isMotion, PLAN_FIELDS, planOf, CONVERSIONS, CTAS, GENDERS, getCampaign, listAds, listAdsets, listCampaigns, listNotes,
  NOTE_KINDS, OBJECTIVES, variantsOf, type Ad, type AdSet, type Campaign,
} from "@/lib/repo/campaigns";
import { getClientRow } from "@/lib/repo/clients";
import { listPages } from "@/lib/repo/leads";
import { getFile } from "@/lib/repo/files";
import { logoSrc } from "@/lib/repo/logos";
import { adsForClient, adTotalsForClient, campaignsWithStats, kyivDay } from "@/lib/repo/meta";
import { CardStrip, CopyBtn, CopyField, FolderButton, GenForm, PrevCarousel, GenCopy, GenDraft, GenTargeting, GenWish, MediaUpload, UseVariant } from "./CampaignClient";

const lbl = (m: Record<string, string>, k: string) => m[k] ?? k;
const opts = (m: Record<string, string>) => Object.entries(m).map(([k, v]) => <option key={k} value={k}>{v}</option>);
const tone = (s: string) => (s === "live" ? "ok" : s === "ready" ? "accent" : s === "paused" ? "warn" : "");

export default function CampaignsView({ clientId, cmp, sel, err }: { clientId: number; cmp?: string; sel?: string; err?: string }) {
  const c = cmp ? getCampaign(Number(cmp)) : undefined;
  if (c && c.client_id === clientId) return <Editor c={c} sel={sel ?? "p"} err={err} />;
  return <List clientId={clientId} />;
}

export function NewCampaign({ clientId, label = "+ Нова кампанія", cls = "btn small" }: { clientId: number; label?: string; cls?: string }) {
  return (
    <Pop wide className="pop-trigger pop-inline" title="Нова кампанія" sub="Мінімум полів — решту дозаповниш або Джері збере сам" trigger={<span className={cls}>{label}</span>}>
      <form action={createCampaignAction} className="stack" style={{ gap: "0.625rem" }}>
        <input type="hidden" name="client_id" value={clientId} />
        <label className="cg-f"><span>Назва</span><input name="name" required placeholder="напр. Ліди · Імплантація · листопад" autoFocus /></label>
        <div className="kp-row2">
          <label className="cg-f"><span>Ціль</span><select name="objective" defaultValue="leads">{opts(OBJECTIVES)}</select></label>
          <label className="cg-f"><span>Бюджет</span><div className="inline"><input name="budget" inputMode="decimal" placeholder="20" style={{ width: "6rem" }} /><select name="budget_type" defaultValue="daily"><option value="daily">на день</option><option value="lifetime">на весь час</option></select></div></label>
        </div>
        <div className="kp-row2">
          <label className="cg-f"><span>Ціль ціни ліда <i>необовʼязково</i></span><input name="target_cpl" inputMode="decimal" placeholder="5" /></label>
          <label className="cg-f"><span>Старт <i>необовʼязково</i></span><input name="start_date" type="date" /></label>
        </div>
        <label className="cg-f"><span>Що рекламуємо / ідея <i>з цього Джері збере групи й тексти</i></span>
          <VoiceTextarea name="idea" placeholder="напр. Акція на імплантацію до кінця місяця, жінки 35+, Позняки — Осокорки, акцент на безболісність і розстрочку" style={{ minHeight: "5rem" }} /></label>
        <label className="lp-check"><input type="checkbox" name="auto" value="1" defaultChecked /> Джері одразу збере задум, групи з таргетингом і по 4 креативи з промптами (тексти — потім, під готові креативи; ~1 хв)</label>
        <div><SubmitButton pendingText="Створюю…">Створити кампанію</SubmitButton></div>
      </form>
    </Pop>
  );
}

function List({ clientId }: { clientId: number }) {
  const cs = listCampaigns(clientId);
  cs.forEach(syncCampaign);
  return (
    <div className="stack" style={{ gap: "1rem" }}>
      <div className="kp-head">
        <div><b>Кампанії</b><span className="mono">Готуємо тут → копіюємо в Ads Manager → цифри й висновки повертаються сюди</span></div>
        <NewCampaign clientId={clientId} />
      </div>
      {cs.length ? (
        <div className="kp-cards">
          {cs.map((c) => {
            const l = campaignLive(c);
            return (
              <Link key={c.id} href={`/clients/${clientId}?tab=meta_ads&mv=campaigns&cmp=${c.id}`} className="card kp-card" scroll={false}>
                <span className="kp-card-top"><span className={`tag ${tone(c.status)}`}>{lbl(CM_STATUS, c.status)}</span><span className="mono">{fmtDate(c.updated_at)}</span></span>
                <b>{c.name}</b>
                <span className="mono">{lbl(OBJECTIVES, c.objective).split(" (")[0]} · {c.budget != null ? `${money2(c.budget)} ${c.budget_type === "daily" ? "/день" : "за весь час"}` : "бюджет —"} · груп {c.adsets} · оголошень {c.ads}</span>
                {l ? <span className="kp-card-live"><span><b>{l.leads}</b> лідів</span><span><b>{money2(l.cpl)}</b> за лід</span><span><b>{money2(l.spend)}</b> витрачено</span></span>
                  : <span className="mono kp-card-hint">{c.status === "draft" ? "Чернетка — доповни і перенеси в Ads Manager" : "Цифри зʼявляться, коли в назві оголошення в Meta буде код AD-N"}</span>}
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="card kp-empty">
          <Icon name="megaphone" size={28} />
          <b>Ще нема кампаній</b>
          <span className="mono">Опиши ідею — Джері збере задум, групи з таргетингом і креативи з промптами, з урахуванням історії клієнта, брендбуку і того, що вже працювало. Тексти — під готові креативи.</span>
          <NewCampaign clientId={clientId} label="+ Перша кампанія" />
        </div>
      )}
    </div>
  );
}

function Live({ l, target }: { l: LiveNums | null; target?: number | null }) {
  if (!l) return null;
  const bad = target != null && l.cpl != null && l.cpl > target * 1.2, good = target != null && l.cpl != null && l.cpl <= target;
  return (
    <div className="kp-live">
      <span className="kp-live-t"><Icon name="zap" size={14} /> Meta · 30 днів</span>
      <span><b>{money2(l.spend)}</b> витрачено</span><span><b>{l.leads}</b> лідів</span>
      <span className={good ? "good" : bad ? "bad" : ""}><b>{money2(l.cpl)}</b> за лід{target != null ? ` (ціль ${money2(target)})` : ""}</span>
      {l.ctr != null && <span><b>{l.ctr.toFixed(2)}%</b> CTR</span>}
    </div>
  );
}

function Editor({ c, sel, err }: { c: Campaign; sel: string; err?: string }) {
  syncCampaign(c);
  const sets = listAdsets(c.id);
  const ads = new Map(sets.map((s) => [s.id, listAds(s.id)]));
  const checks = campaignChecks(c);
  const base = `/clients/${c.client_id}?tab=meta_ads&mv=campaigns&cmp=${c.id}`;
  const selS = sel.startsWith("s") ? sets.find((s) => s.id === Number(sel.slice(1))) : undefined;
  const selA = sel.startsWith("a") ? [...ads.values()].flat().find((a) => a.id === Number(sel.slice(1))) : undefined;
  const view = selA ? "a" : selS ? "s" : sel === "j" ? "j" : sel === "p" ? "p" : "c";
  const clientName = getClientRow(c.client_id)?.name ?? "";
  const chat = campaignChatPrompt(c, clientName);
  const bad = checks.filter((x) => x.level === "bad").length, warn = checks.filter((x) => x.level === "warn").length;
  const hid = <input type="hidden" name="campaign_id" value={c.id} />;
  const notes = listNotes(c.id);

  return (
    <div className="stack" style={{ gap: "1rem" }}>
      <div className="kp-ed-head">
        <Link href={`/clients/${c.client_id}?tab=meta_ads&mv=campaigns`} className="h-link" scroll={false}>← Усі кампанії</Link>
        <div className="kp-ed-title">
          <h2>{c.name}</h2>
          <span className={`tag ${tone(c.status)}`}>{lbl(CM_STATUS, c.status)}</span>
        </div>
        <div className="kp-ed-act">
          <FolderButton campaignId={c.id} url={c.drive_folder_id ? `https://drive.google.com/drive/folders/${c.drive_folder_id}` : undefined} />
          <CopyBtn text={creativeBrief(c.client_id)} label="⧉ 1. Контекст клієнта" small />
          {chat.includes("### AD-") && <CopyBtn text={chat} label="⧉ 2. Усі креативи для Claude-чату" small />}
          <CopyBtn text={campaignMd(c)} label="⧉ Уся кампанія текстом" small />
          {![...ads.values()].flat().length && <GenDraft campaignId={c.id} />}
          <Pop className="pop-trigger pop-inline" title="Кампанія" trigger={<span className="btn ghost small">⋯</span>}>
            <div className="stack" style={{ gap: "0.5rem" }}>
              <form action={duplicateCampaignAction}>{hid}<button className="ghost small">Дублювати кампанію з усіма групами й оголошеннями</button></form>
              <form action={deleteCampaignAction}>{hid}<button className="ghost small danger-text">Видалити кампанію</button></form>
            </div>
          </Pop>
        </div>
      </div>
      {err && <div className="mx-warn"><Icon name="alert" size={15} /> {err}</div>}
      <Live l={campaignLive(c)} target={c.target_cpl} />

      <div className="kp-ed">
        <aside className="kp-tree" aria-label="Структура кампанії">
          <Link href={`${base}&sel=p`} scroll={false} className={`kp-node lv0${view === "p" ? " on" : ""}`}><Icon name="sparkles" size={15} /><span>Задум · думка Джері</span></Link>
          <Link href={`${base}&sel=c`} scroll={false} className={`kp-node lv0${view === "c" ? " on" : ""}`}><Icon name="flag" size={15} /><span>Кампанія</span>{(bad || warn) ? <i className={`kp-dot ${bad ? "bad" : "warn"}`}>{bad + warn}</i> : null}</Link>
          {sets.map((s) => (
            <div key={s.id} className="kp-branch">
              <Link href={`${base}&sel=s${s.id}`} scroll={false} className={`kp-node lv1${selS?.id === s.id ? " on" : ""}`}><Icon name="users" size={15} /><span>{s.name}</span><i className="kp-n">{ads.get(s.id)!.length}</i></Link>
              {ads.get(s.id)!.map((a) => (
                <Link key={a.id} href={`${base}&sel=a${a.id}`} scroll={false} className={`kp-node lv2${selA?.id === a.id ? " on" : ""}`}>
                  <Thumb a={a} /><span>{a.name.replace(/^AD-\d+\s*·\s*/, "")}<small>{adCode(a)} · {lbl(AD_STATUS, a.status)}</small></span>
                </Link>
              ))}
              <form action={adsetOpAction} className="kp-node-add"><input type="hidden" name="adset_id" value={s.id} /><input type="hidden" name="op" value="add_ad" /><button className="ghost small">+ Оголошення</button></form>
            </div>
          ))}
          <form action={addAdsetAction} className="kp-node-add lv0">{hid}<button className="ghost small">+ Група оголошень</button></form>
          <Link href={`${base}&sel=j`} scroll={false} className={`kp-node lv0 kp-j${view === "j" ? " on" : ""}`}><Icon name="clock" size={15} /><span>Журнал і висновки</span><i className="kp-n">{notes.length}</i></Link>
        </aside>
        <section className="kp-panel">
          {view === "p" && <PlanPanel c={c} hid={hid} />}
          {view === "c" && <CampaignPanel c={c} checks={checks} hid={hid} />}
          {view === "s" && selS && <AdsetPanel c={c} s={selS} ads={ads.get(selS.id)!} />}
          {view === "a" && selA && <AdPanel c={c} s={sets.find((s) => s.id === selA.adset_id)!} a={selA} />}
          {view === "j" && <Journal c={c} hid={hid} />}
        </section>
      </div>
    </div>
  );
}

function Thumb({ a }: { a: Ad }) {
  const src = a.file_id ? `/api/files/${a.file_id}` : a.media_url;
  const isVideo = a.file_id ? !!getFile(a.file_id)?.mime.startsWith("video/") : false;
  if (!src) return <i className="kp-thumb kp-none"><Icon name="sparkles" size={13} /></i>;
  if (isVideo && a.file_id) return <i className="kp-thumb vid">▶</i>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="kp-thumb" src={src} alt="" />;
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return <div className="card kp-sec"><div className="kp-sec-h"><b>{title}</b>{action}</div>{children}</div>;
}

function PlanPanel({ c, hid }: { c: Campaign; hid: React.ReactNode }) {
  const plan = planOf(c);
  const filled = Object.values(plan).some(Boolean);
  return (
    <div className="stack" style={{ gap: "0.875rem" }}>
      <Section title="Задум кампанії — загальна картина" action={<span className="mono">думка Джері · клікни блок, щоб поправити</span>}>
        {c.idea && <div className="kp-idea"><b>Ідея</b><p>{c.idea}</p></div>}
        <div className="eb-grid">
          {(Object.keys(PLAN_FIELDS) as (keyof typeof PLAN_FIELDS)[]).map((k) => (
            <EditBlock key={k} title={PLAN_FIELDS[k].label} name={k} value={plan[k] ?? ""} action={savePlanAction} hidden={hid} hint={PLAN_FIELDS[k].hint} rows={6} />
          ))}
        </div>
        <GenWish kind="plan" id={c.id} label="✨ Джері: задум кампанії" again={filled ? "✨ Переосмислити" : undefined} placeholder="Що врахувати: напр. «ціль — 30 заявок за місяць», «конкурент знизив ціни»" wait="Джері думає… ~30 с" />
      </Section>
    </div>
  );
}

function CampaignPanel({ c, checks, hid }: { c: Campaign; checks: ReturnType<typeof campaignChecks>; hid: React.ReactNode }) {
  const metaCamps = campaignsWithStats(c.client_id, kyivDay(29));
  return (
    <div className="stack" style={{ gap: "0.875rem" }}>
      <Section title="1 · Кампанія — як у Ads Manager" action={
        <Pop wide closeOnSubmit className="pop-trigger pop-inline" title="Кампанія" trigger={<span className="btn ghost small">Змінити</span>}>
          <form action={saveCampaignAction} className="stack" style={{ gap: "0.625rem" }}>
            {hid}
            <label className="cg-f"><span>Назва</span><input name="name" defaultValue={c.name} required /></label>
            <div className="kp-row2">
              <label className="cg-f"><span>Ціль</span><select name="objective" defaultValue={c.objective}>{opts(OBJECTIVES)}</select></label>
              <label className="cg-f"><span>Стан</span><select name="status" defaultValue={c.status}>{opts(CM_STATUS)}</select></label>
            </div>
            <div className="kp-row2">
              <label className="cg-f"><span>Бюджет</span><div className="inline"><input name="budget" defaultValue={c.budget ?? ""} inputMode="decimal" style={{ width: "6rem" }} /><select name="budget_type" defaultValue={c.budget_type}><option value="daily">на день</option><option value="lifetime">на весь час</option></select></div></label>
              <label className="cg-f"><span>Де бюджет</span><select name="budget_level" defaultValue={c.budget_level}><option value="campaign">На кампанію (Advantage+)</option><option value="adset">На кожну групу</option></select></label>
            </div>
            <div className="kp-row2">
              <label className="cg-f"><span>Старт</span><input type="date" name="start_date" defaultValue={c.start_date} /></label>
              <label className="cg-f"><span>Кінець <i>необовʼязково</i></span><input type="date" name="end_date" defaultValue={c.end_date} /></label>
            </div>
            <div className="kp-row2">
              <label className="cg-f"><span>Ціль ціни ліда</span><input name="target_cpl" defaultValue={c.target_cpl ?? ""} inputMode="decimal" /></label>
              <label className="cg-f"><span>Спецкатегорія <i>кредит, житло, робота, політика</i></span><input name="special_category" defaultValue={c.special_category} placeholder="нема" /></label>
            </div>
            <label className="cg-f"><span>Ідея / що рекламуємо</span><VoiceTextarea name="idea" defaultValue={c.idea} style={{ minHeight: "4.5rem" }} /></label>
            <label className="cg-f"><span>Кампанія в Meta <i>після запуску — для цифр</i></span>
              <select name="meta_campaign_id" defaultValue={c.meta_campaign_id}><option value="">— не звʼязано (або сама знайдеться за кодом AD-N) —</option>{metaCamps.map((m) => <option key={m.campaign_id} value={m.campaign_id}>{m.name} · {m.status}</option>)}</select></label>
            <div><SubmitButton className="small">Зберегти</SubmitButton></div>
          </form>
        </Pop>
      }>
        <CopyField label="Назва кампанії" value={c.name} />
        <CopyField label="Ціль" value={lbl(OBJECTIVES, c.objective)} />
        <CopyField label="Спецкатегорія оголошень" value={c.special_category || "Нема"} />
        <CopyField label={c.budget_level === "campaign" ? "Бюджет кампанії (Advantage+)" : "Бюджет — на рівні груп"} value={c.budget == null ? "" : `${money2(c.budget)} ${c.budget_type === "daily" ? "— денний" : "— на весь час"}`} />
        <CopyField label="Розклад" value={c.start_date ? `${c.start_date}${c.end_date ? ` → ${c.end_date}` : " (без кінця)"}` : ""} />
        {c.idea && <div className="kp-idea"><b>Ідея</b><p>{c.idea}</p></div>}
      </Section>
      <Section title="Усі назви — по черзі в Ads Manager">
        <CopyField label="Кампанія" value={c.name} />
        {listAdsets(c.id).map((st) => (
          <div key={st.id} className="kp-names">
            <CopyField label="Група оголошень" value={st.name} />
            {listAds(st.id).map((ad) => <CopyField key={ad.id} label={`↳ Оголошення ${adCode(ad)}`} value={ad.name} />)}
          </div>
        ))}
      </Section>
      <Section title={`Перевірка перед запуском${checks.length ? ` · ${checks.length}` : ""}`}>
        {checks.length ? <ul className="kp-checks">{checks.map((x, i) => <li key={i} className={x.level}><span className="kp-ck-w">{x.where}</span>{x.text}</li>)}</ul>
          : <p className="mono" style={{ margin: 0 }}>✓ Усе заповнено — можна переносити в Ads Manager.</p>}
      </Section>
    </div>
  );
}

function AdsetPanel({ c, s, ads }: { c: Campaign; s: AdSet; ads: Ad[] }) {
  const hid = <input type="hidden" name="adset_id" value={s.id} />;
  const interests = s.interests.split("\n").map((x) => x.trim()).filter(Boolean);
  return (
    <div className="stack" style={{ gap: "0.875rem" }}>
      <Section title="2 · Група оголошень" action={
        <span className="inline">
          <Pop wide closeOnSubmit className="pop-trigger pop-inline" title={`Група: ${s.name}`} trigger={<span className="btn ghost small">Змінити</span>}>
            <form action={saveAdsetAction} className="stack" style={{ gap: "0.625rem" }}>
              {hid}
              <label className="cg-f"><span>Назва групи</span><input name="name" defaultValue={s.name} required /></label>
              <div className="kp-row2">
                <label className="cg-f"><span>Куди ведемо</span><select name="conversion" defaultValue={s.conversion}>{opts(CONVERSIONS)}</select></label>
                <label className="cg-f"><span>Бюджет групи <i>{c.budget_level === "campaign" ? "не треба: бюджет на кампанію" : "на день"}</i></span><input name="budget" defaultValue={s.budget ?? ""} inputMode="decimal" /></label>
              </div>
              <label className="cg-f"><span>Посилання <i>для сайту</i></span><input name="url" defaultValue={s.url} placeholder="https://" /></label>
              <label className="cg-f"><span>Локації</span><input name="locations" defaultValue={s.locations} placeholder="Київ +15 км; Бровари" /></label>
              <div className="kp-row3">
                <label className="cg-f"><span>Вік від</span><input name="age_min" type="number" min={13} max={65} defaultValue={s.age_min} /></label>
                <label className="cg-f"><span>до</span><input name="age_max" type="number" min={13} max={65} defaultValue={s.age_max} /></label>
                <label className="cg-f"><span>Стать</span><select name="gender" defaultValue={s.gender}>{opts(GENDERS)}</select></label>
              </div>
              <label className="cg-f"><span>Мови <i>необовʼязково</i></span><input name="languages" defaultValue={s.languages} placeholder="українська, російська" /></label>
              <label className="cg-f"><span>Детальний таргетинг <i>по рядку</i></span><VoiceTextarea name="interests" defaultValue={s.interests} style={{ minHeight: "5rem" }} /></label>
              <label className="cg-f"><span>Виключити <i>по рядку</i></span><textarea name="exclusions" defaultValue={s.exclusions} style={{ minHeight: "3rem" }} /></label>
              <label className="cg-f"><span>Власні / схожі аудиторії</span><input name="audiences" defaultValue={s.audiences} placeholder="Lookalike 1% з клієнтів; відвідувачі сайту 30 дн." /></label>
              <input type="hidden" name="advantage_present" value="1" />
              <label className="lp-check"><input type="checkbox" name="advantage" value="1" defaultChecked={!!s.advantage} /> Advantage+ аудиторія (Meta розширює сама)</label>
              <label className="cg-f"><span>Плейсменти</span><input name="placements" defaultValue={s.placements} placeholder="advantage = автоматично" /></label>
              <label className="cg-f"><span>Нотатка про форму <i>самі форми — у «Лід-форми» і в кожному оголошенні</i></span><textarea name="form" defaultValue={s.form} style={{ minHeight: "3rem" }} /></label>
              <div><SubmitButton className="small">Зберегти</SubmitButton></div>
            </form>
          </Pop>
          <Pop className="pop-trigger pop-inline" title="Група" trigger={<span className="btn ghost small">⋯</span>}>
            <div className="stack" style={{ gap: "0.5rem" }}>
              <form action={adsetOpAction}>{hid}<input type="hidden" name="op" value="duplicate" /><button className="ghost small">Дублювати групу з оголошеннями (напр. інше місто)</button></form>
              <form action={adsetOpAction}>{hid}<input type="hidden" name="op" value="delete" /><button className="ghost small danger-text">Видалити групу</button></form>
            </div>
          </Pop>
        </span>
      }>
        <CopyField label="Назва групи" value={s.name} />
        <CopyField label="Місце конверсії" value={lbl(CONVERSIONS, s.conversion)} />
        {s.url && <CopyField label="Посилання" value={s.url} />}
        {c.budget_level === "adset" && <CopyField label="Бюджет групи" value={s.budget == null ? "" : `${money2(s.budget)} ${c.budget_type === "daily" ? "/день" : ""}`} />}
        <CopyField label="Локації" value={s.locations} />
        <CopyField label="Вік" value={`${s.age_min}–${s.age_max === 65 ? "65+" : s.age_max}`} />
        <CopyField label="Стать" value={lbl(GENDERS, s.gender)} />
        {s.languages && <CopyField label="Мови" value={s.languages} />}
        <div className="kp-f multi">
          <div className="kp-f-h"><span className="kp-f-l">Детальний таргетинг<i>{s.advantage ? "Advantage+ — як підказка" : "жорстко"}</i></span><CopyBtn text={interests.join(", ")} label="Копіювати всі" /></div>
          {interests.length ? <div className="kp-chips">{interests.map((x) => <span key={x} className="kp-chip">{x}<CopyBtn text={x} label="⧉" /></span>)}</div> : <div className="kp-f-v kp-none">— широка аудиторія</div>}
        </div>
        {s.exclusions && <CopyField label="Виключити" value={s.exclusions.split("\n").filter(Boolean).join(", ")} />}
        {s.audiences && <CopyField label="Власні аудиторії" value={s.audiences} />}
        <CopyField label="Плейсменти" value={s.placements === "advantage" ? "Advantage+ плейсменти (автоматично)" : s.placements} />
        {s.form && <CopyField label="Нотатка про форму" value={s.form} multiline />}
        <div><CopyBtn text={adsetTargeting(s)} label="⧉ Весь таргетинг текстом" small /></div>
      </Section>
      <Section title="Джері"><GenTargeting adsetId={s.id} /></Section>
      <Section title={`Оголошення в групі · ${ads.length}`}>
        <div className="kp-ad-list">
          {ads.map((a) => (
            <Link key={a.id} href={`/clients/${c.client_id}?tab=meta_ads&mv=campaigns&cmp=${c.id}&sel=a${a.id}`} scroll={false} className="kp-ad-row">
              <Thumb a={a} /><span><b>{a.name}</b><small>{a.headline || "без заголовка"} · {lbl(AD_STATUS, a.status)}</small></span>
            </Link>
          ))}
          <form action={adsetOpAction}>{hid}<input type="hidden" name="op" value="add_ad" /><button className="ghost small">+ Оголошення</button></form>
        </div>
      </Section>
    </div>
  );
}

function AdPanel({ c, s, a }: { c: Campaign; s: AdSet; a: Ad }) {
  const hid = <input type="hidden" name="ad_id" value={a.id} />;
  const v = variantsOf(a);
  const client = getClientRow(c.client_id);
  const logo = logoSrc("client", c.client_id);
  const f = a.file_id ? getFile(a.file_id) : undefined;
  const src = a.file_id ? `/api/files/${a.file_id}` : a.media_url;
  const isVideo = f ? f.mime.startsWith("video/") : isMotion(a.format) && !!a.media_url && /\.(mp4|mov|webm)(\?|$)/i.test(a.media_url);
  const url = adUrl(a, s);
  const metaAds = adsForClient(c.client_id);
  const totals = adTotalsForClient(c.client_id);
  const winners = metaAds.filter((m) => m.image_url || m.thumbnail_url).map((m) => { const t = totals.find((x) => x.ad_id === m.ad_id); return { m, cpl: t?.leads ? t.spend / t.leads : null, leads: t?.leads ?? 0 }; })
    .sort((x, y) => (x.cpl ?? 1e9) - (y.cpl ?? 1e9)).slice(0, 12);
  const live = adLive(a, metaAds);
  const promptFull = adPromptFull(c, a, client?.name ?? "");
  const cards = cardsOf(a);
  const form = a.form_id ? getForm(a.form_id) : undefined;
  const forms = listForms(c.client_id, true);
  const pages = listPages().filter((p) => p.client_id === c.client_id && !p.hidden);
  const ct = cardTextsOf(a);
  return (
    <div className="stack" style={{ gap: "0.875rem" }}>
      <Live l={live} target={c.target_cpl} />
      <div className="kp-ad">
        {/* Як виглядатиме в стрічці */}
        <div className="kp-prev">
          <div className="kp-prev-h">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {logo ? <img src={logo} alt="" /> : <i>{(client?.name ?? "?").replace(/^Тест:\s*/, "").slice(0, 1)}</i>}
            <span><b>{client?.name.replace(/^Тест:\s*/, "")}</b><small>Реклама</small></span>
          </div>
          <div className="kp-prev-t">{a.primary_text ? <>{a.primary_text.slice(0, LIMITS.primary)}{a.primary_text.length > LIMITS.primary && <span className="kp-more">… Ще</span>}</> : <span className="mono">Основний текст</span>}</div>
          {cards.length > 1 ? <PrevCarousel cards={cards.map((id) => ({ id, ...(ct[String(id)] ?? {}) }))} cta={lbl(CTAS, a.cta).split(" · ")[0]} /> :
          <div className={`kp-prev-m${src ? "" : " kp-none"}`} style={{ aspectRatio: ({ square: "1", carousel: "1", story: "9 / 16", motion: "9 / 16", video: "9 / 16", wide: "16 / 9" } as Record<string, string>)[a.format] ?? "4 / 5" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {!src ? <span>{lbl(AD_FORMATS, a.format)}<br />креатив ще не додано</span> : isVideo ? <video src={src} controls preload="metadata" /> : <img src={src} alt="" />}
          </div>}
          {cards.length < 2 && <div className="kp-prev-f">
            <span><small>{url ? (() => { try { return new URL(url).hostname.toUpperCase(); } catch { return ""; } })() : lbl(CONVERSIONS, s.conversion).split(" (")[0].toUpperCase()}</small><b>{a.headline || "Заголовок"}</b>{a.description && <small>{a.description}</small>}</span>
            <i>{lbl(CTAS, a.cta).split(" · ")[0]}</i>
          </div>}
        </div>

        <div className="stack" style={{ gap: "0.875rem", minWidth: 0 }}>
          <Section title="Оголошення — що вставити в Ads Manager">
            <CopyField label="Назва оголошення" value={a.name} hint="з кодом AD-N — по ньому підтягнуться цифри" />
            {pages.length > 0 && <CopyField label="Сторінка Facebook" value={pages.map((p) => p.name).join(" / ")} />}
            <CopyField label="Формат" value={lbl(AD_FORMATS, a.format)} />
            <CopyField label="Файл креативу" value={cards.length > 1 ? cards.map((_, i) => fileNameFor(a).replace("_v1", `_${i + 1}_v1`)).join(", ") : fileNameFor(a)} hint={c.drive_folder_id ? "лежить у папці кампанії" : "так назви файл"} />
            {c.drive_folder_id && <CopyField label="Папка кампанії на Диску" value={campaignFolderName(c)} />}
            {s.conversion === "form" && <CopyField label="Лід-форма" value={form ? `${form.name} v${form.version}` : ""} hint={form ? "" : "ще не вибрана — нижче"} />}
            <CopyField label="Кнопка (CTA)" value={lbl(CTAS, a.cta)} />
            {(url || s.conversion === "site") && <CopyField label="Посилання з UTM" value={url} />}
          </Section>

          <Section title="3 · Креатив" action={
            <span className="inline">
              <span className="tag accent">{lbl(AD_FORMATS, a.format)}</span>{a.tool && <span className="tag">{a.tool}</span>}
              <Pop wide closeOnSubmit className="pop-trigger pop-inline" title={`Креатив ${adCode(a)}`} trigger={<span className="btn ghost small">Змінити</span>}>
                <form action={saveAdAction} className="stack" style={{ gap: "0.625rem" }}>
                  {hid}
                  <div className="kp-row2">
                    <label className="cg-f"><span>Формат і розмір</span><select name="format" defaultValue={a.format}>{opts(AD_FORMATS)}</select></label>
                    <label className="cg-f"><span>Чим робимо</span><input name="tool" defaultValue={a.tool} list="kp-tools" placeholder="Midjourney" /></label>
                  </div>
                  <datalist id="kp-tools">{CREATIVE_TOOLS.map((t) => <option key={t} value={t} />)}</datalist>
                  <label className="cg-f"><span>Кут / ідея</span><input name="angle" defaultValue={a.angle} /></label>
                  <label className="cg-f"><span>Текст на креативі</span><textarea name="overlay" defaultValue={a.overlay} style={{ minHeight: "3.5rem" }} /></label>
                  <label className="cg-f"><span>Промпт</span><VoiceTextarea name="creative_prompt" defaultValue={a.creative_prompt} style={{ minHeight: "9rem" }} /></label>
                  <label className="cg-f"><span>Посилання на готовий креатив <i>якщо не завантажуєш файл</i></span><input name="media_url" defaultValue={a.file_id ? "" : a.media_url} placeholder="https://…" /></label>
                  <div><SubmitButton className="small">Зберегти</SubmitButton></div>
                </form>
              </Pop>
            </span>
          }>
            {a.angle && <div className="kp-idea"><b>Кут</b><p>{a.angle}</p></div>}
            {a.overlay && <CopyField label="Текст на креативі" value={a.overlay} hint="що написати на креативі" multiline />}
            {a.creative_prompt ? <CopyField label="Промпт для генерації" value={promptFull} hint="+ куди зберегти файл" multiline />
              : <p className="mono" style={{ margin: 0 }}>Промпту ще нема — Джері напише бриф: формат, розмір, текст на креативі і готовий промпт.</p>}
            <GenWish kind="brief" id={a.id} label="✨ Бриф і промпт від Джері" again={a.creative_prompt ? "✨ Інший варіант" : undefined} placeholder="Побажання: напр. «моушен замість статики», «на фоні рендеру будинку»" />
            <div className="kp-up">
              <b>Готовий креатив</b>
              <MediaUpload adId={a.id} has={!!src} carousel={a.format === "carousel"} />
              {cards.length > 1 && <CardStrip adId={a.id} cards={cards} />}
              <span className="inline" style={{ flexWrap: "wrap" }}>
                {src && <form action={adOpAction} className="inline">{hid}<input type="hidden" name="op" value="clear_media" /><button className="ghost small">Прибрати</button></form>}
                {winners.length > 0 && (
                  <Pop wide className="pop-trigger pop-inline" title="Креатив з робочих оголошень" sub="Найдешевші за ціною ліда зверху — переможця не треба малювати заново" trigger={<span className="btn ghost small">Взяти з Meta ({winners.length})</span>}>
                    <div className="kp-pick">
                      {winners.map(({ m, cpl, leads }) => (
                        <form key={m.ad_id} action={mediaFromMetaAction} className="kp-pick-i">
                          {hid}<input type="hidden" name="meta_ad_id" value={m.ad_id} />
                          <button>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={m.image_url || m.thumbnail_url} alt="" />
                            <span><b>{m.name}</b><small>{cpl != null ? `${money2(cpl)} за лід · ${leads} лідів` : "лідів ще нема"}</small></span>
                          </button>
                        </form>
                      ))}
                    </div>
                  </Pop>
                )}
              </span>
            </div>
          </Section>

          <Section title="4 · Тексти оголошення" action={
            <span className="inline">
              <Pop wide closeOnSubmit className="pop-trigger pop-inline" title={adCode(a)} sub="Код AD-N залиш у назві оголошення в Meta — по ньому підтягнуться цифри" trigger={<span className="btn ghost small">Змінити</span>}>
                <form action={saveAdAction} className="stack" style={{ gap: "0.625rem" }}>
                  {hid}
                  <div className="kp-row2">
                    <label className="cg-f"><span>Назва</span><input name="name" defaultValue={a.name.replace(/^AD-\d+\s*·\s*/, "")} /></label>
                    <label className="cg-f"><span>Стан</span><select name="status" defaultValue={a.status}>{opts(AD_STATUS)}</select></label>
                  </div>
                  <label className="cg-f"><span>Основний текст <i>головне — в перших {LIMITS.primary} симв.</i></span><VoiceTextarea name="primary_text" defaultValue={a.primary_text} style={{ minHeight: "8rem" }} /></label>
                  <div className="kp-row2">
                    <label className="cg-f"><span>Заголовок <i>до {LIMITS.headline}</i></span><input name="headline" defaultValue={a.headline} maxLength={120} /></label>
                    <label className="cg-f"><span>Опис <i>до {LIMITS.description}</i></span><input name="description" defaultValue={a.description} maxLength={120} /></label>
                  </div>
                  <label className="cg-f"><span>Кнопка</span><select name="cta" defaultValue={a.cta}>{opts(CTAS)}</select></label>
                  <label className="cg-f"><span>Посилання</span><input name="url" defaultValue={a.url} placeholder={s.url || "https://"} /></label>
                  <label className="cg-f"><span>UTM</span><input name="utm" defaultValue={a.utm} placeholder="utm_source=facebook&utm_medium=paid…" /></label>
                  <label className="lp-check"><input type="checkbox" name="utm_auto" value="1" /> Поставити UTM автоматично (кампанія + код AD-N)</label>
                  <label className="cg-f"><span>Нотатка</span><textarea name="notes" defaultValue={a.notes} style={{ minHeight: "3rem" }} /></label>
                  <div><SubmitButton className="small">Зберегти</SubmitButton></div>
                </form>
              </Pop>
              <Pop className="pop-trigger pop-inline" title="Оголошення" trigger={<span className="btn ghost small">⋯</span>}>
                <div className="stack" style={{ gap: "0.5rem" }}>
                  <form action={adOpAction}>{hid}<input type="hidden" name="op" value="duplicate" /><button className="ghost small">Дублювати (новий код AD-N)</button></form>
                  <form action={adOpAction}>{hid}<input type="hidden" name="op" value="delete" /><button className="ghost small danger-text">Видалити оголошення</button></form>
                </div>
              </Pop>
            </span>
          }>
            {!src && !a.primary_text && <p className="mono kp-wait">Тексти пишемо під готовий креатив: завантаж фото/відео вище — Джері подивиться на нього і напише. {a.creative_prompt && "Можна і зараз — по брифу."}</p>}
            <GenCopy adId={a.id} has={!!v.primary?.length} />
            {(v.primary?.length ?? 0) > 0 && (
              <div className="kp-vars">
                <b className="kp-vars-h">Варіанти основного тексту <i>Meta дозволяє до 5 — можна вставити всі</i></b>
                {v.primary!.map((x, i) => <UseVariant key={`p${i}`} adId={a.id} field="primary_text" value={x} current={x === a.primary_text} />)}
                {(v.headline?.length ?? 0) > 0 && <b className="kp-vars-h">Заголовки</b>}
                {v.headline?.map((x, i) => <UseVariant key={`h${i}`} adId={a.id} field="headline" value={x} current={x === a.headline} />)}
                {(v.description?.length ?? 0) > 0 && <b className="kp-vars-h">Описи</b>}
                {v.description?.map((x, i) => <UseVariant key={`d${i}`} adId={a.id} field="description" value={x} current={x === a.description} />)}
                {(v.tips?.length ?? 0) > 0 && <ul className="kp-tips">{v.tips!.map((t, i) => <li key={i}>{t}</li>)}</ul>}
              </div>
            )}
            {(a.primary_text || a.headline) && (
              <>
                <CopyField label="Основний текст" value={a.primary_text} limit={LIMITS.primary} soft hint="далі — під «Ще»" multiline />
                <CopyField label="Заголовок" value={a.headline} limit={LIMITS.headline} />
                <CopyField label="Опис" value={a.description} limit={LIMITS.description} />
              </>
            )}
            {cards.length > 1 && (
              <div className="kp-ctexts">
                <b className="kp-vars-h">Картки каруселі <i>заголовок до {CARD_LIMITS.headline}, опис до {CARD_LIMITS.description}; порожнє посилання = посилання оголошення</i></b>
                {cards.map((id, i) => {
                  const t = ct[String(id)] ?? {};
                  return (
                    <div key={id} className="kp-ctext">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/files/${id}`} alt="" />
                      <div className="kp-ctext-b">
                        <div className="kp-ctext-h"><b>Картка {i + 1}</b>
                          <Pop closeOnSubmit className="pop-trigger pop-inline" title={`Картка ${i + 1}`} trigger={<span className="btn ghost small">Змінити</span>}>
                            <form action={saveCardAction} className="stack" style={{ gap: "0.625rem" }}>
                              {hid}<input type="hidden" name="file_id" value={id} />
                              <label className="cg-f"><span>Заголовок <i>до {CARD_LIMITS.headline}</i></span><input name="headline" defaultValue={t.headline ?? ""} maxLength={120} autoFocus /></label>
                              <label className="cg-f"><span>Опис <i>до {CARD_LIMITS.description}</i></span><input name="description" defaultValue={t.description ?? ""} maxLength={120} /></label>
                              <label className="cg-f"><span>Посилання <i>порожньо = як в оголошенні</i></span><input name="url" defaultValue={t.url ?? ""} placeholder={url || "https://"} /></label>
                              <div><SubmitButton className="small">Зберегти</SubmitButton></div>
                            </form>
                          </Pop>
                        </div>
                        <CopyField label="Заголовок" value={t.headline ?? ""} limit={CARD_LIMITS.headline} />
                        <CopyField label="Опис" value={t.description ?? ""} limit={CARD_LIMITS.description} />
                        {(t.url || url) && <CopyField label="Посилання" value={t.url || url} hint={t.url ? "" : "як в оголошенні"} />}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {a.notes && <div className="kp-idea"><b>Нотатка</b><p>{a.notes}</p></div>}
          </Section>

          {s.conversion === "form" && (
            <Section title="Лід-форма" action={<Link href={`/clients/${c.client_id}?tab=meta_ads&mv=forms${form ? `&form=${form.id}` : ""}`} className="h-link">{form ? "Відкрити форму →" : "Бібліотека форм →"}</Link>}>
              {form ? (
                <div className="kp-fsum">
                  <b>{form.name} <span className="tag accent">v{form.version}</span></b>
                  <span className="mono">{form.intro_headline}</span>
                  <ol>{parseQuestions(form.questions).map((q, i) => <li key={i}>{q.label}{q.options.length ? <small> — {q.options.join(" / ")}</small> : null}</li>)}</ol>
                  <div><CopyBtn text={formMd(form)} label="⧉ Уся форма текстом" small /></div>
                </div>
              ) : <p className="mono" style={{ margin: 0 }}>Форми ще нема — вибери з бібліотеки або нехай Джері складе під це оголошення.</p>}
              <form action={attachFormAction} className="kp-gen">
                {hid}
                <select name="form_id" defaultValue={a.form_id ?? ""}><option value="">— без форми —</option>{forms.map((x) => <option key={x.id} value={x.id}>{x.name} · v{x.version}{x.status !== "active" ? " (архів)" : ""}</option>)}</select>
                <SubmitButton className="small">Підключити</SubmitButton>
              </form>
              <GenForm clientId={c.client_id} adId={a.id} label={form ? "✨ Інша форма від Джері" : "✨ Форма від Джері"} />
            </Section>
          )}

          <Section title="Що вийшло">
            <form action={noteAction} className="kp-rate">
              <input type="hidden" name="campaign_id" value={c.id} /><input type="hidden" name="ad_id" value={a.id} /><input type="hidden" name="adset_id" value={s.id} />
              <input name="text" placeholder="Коментар: що зайшло / що ні і чому" />
              <button name="kind" value="win" className="ghost small">👍 Зайшло</button>
              <button name="kind" value="lose" className="ghost small">👎 Не зайшло</button>
              <button name="kind" value="note" className="ghost small">📝</button>
            </form>
            <span className="mono">До оцінки сам допишу цифри з Meta на цей момент. Джері враховує це в наступних текстах.</span>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Journal({ c, hid }: { c: Campaign; hid: React.ReactNode }) {
  const notes = listNotes(c.id);
  return (
    <div className="stack" style={{ gap: "0.875rem" }}>
      <Section title="Журнал і висновки">
        <form action={noteAction} className="kp-note-form">
          {hid}
          <select name="kind" defaultValue="note">{Object.entries(NOTE_KINDS).map(([k, x]) => <option key={k} value={k}>{x.ico} {x.label}</option>)}</select>
          <VoiceTextarea name="text" required placeholder="Що змінив / що помітив / який висновок. «Урок» — Джері враховує в усіх наступних кампаніях." style={{ minHeight: "4rem" }} />
          <div><SubmitButton className="small">Записати</SubmitButton></div>
        </form>
      </Section>
      <Section title={`Історія · ${notes.length}`}>
        {notes.length ? (
          <ul className="kp-notes">
            {notes.map((n) => (
              <li key={n.id} className={`k-${n.kind}`}>
                <span className="kp-note-i">{NOTE_KINDS[n.kind]?.ico ?? "•"}</span>
                <span className="kp-note-b"><small>{fmtDate(n.created_at)} · {NOTE_KINDS[n.kind]?.label ?? n.kind}</small>{n.text}</span>
                <form action={deleteNoteAction}>{hid}<input type="hidden" name="note_id" value={n.id} /><button className="ghost small" aria-label="Видалити">✕</button></form>
              </li>
            ))}
          </ul>
        ) : <p className="mono" style={{ margin: 0 }}>Поки порожньо. Зміни стану й бюджету пишуться сюди самі.</p>}
      </Section>
    </div>
  );
}
