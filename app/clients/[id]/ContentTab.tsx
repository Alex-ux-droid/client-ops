// Студія контенту клієнта: Огляд (конвеєр + запуск) · План (календар місяця) · Пости (дошка) · Матеріали (Диск) · Стратегія · Налаштування.
// Модель: рубрики і стратегія → план по тижнях → пост (шаблон + слоти) → рендер → апрув → публікація. Візуал — тільки реальні матеріали клієнта.
import Link from "next/link";
import EditBlock from "@/components/EditBlock";
import FileThumb from "@/components/FileThumb";
import Pop from "@/components/Pop";
import SubmitButton from "@/components/SubmitButton";
import { assetAction, pillarAction, postAction, saveSocialAction, syncAssetsAction, weekThemeAction } from "@/app/content/actions";
import { driveReadAll, googleConnected } from "@/lib/google";
import { metaToken, metaTokenCheck } from "@/lib/meta";
import { listColors } from "@/lib/repo/brand";
import { ASSET_KINDS, PIPELINE, POST_STATUS, TPL_STATUS, assetCounts, listAssets, listPillars, listPosts, listTemplates, postsBetween, statusCounts, weekThemes, type Asset, type Pillar, type Post } from "@/lib/repo/content";
import { getSetting } from "@/lib/repo/settings";
import { FORMATS, WEEKDAYS, cadenceOf, getSocial, slotsOf, type Format, type SocialProfile } from "@/lib/repo/social";

const VIEWS = [
  ["overview", "Огляд"], ["plan", "План"], ["posts", "Пости"], ["assets", "Матеріали"], ["strategy", "Стратегія"], ["settings", "Налаштування"],
] as const;
type View = (typeof VIEWS)[number][0];

const kyivToday = () => new Date().toLocaleString("sv-SE", { timeZone: "Europe/Kyiv" }).slice(0, 10);
const addDays = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const mondayOf = (d: string) => { const wd = (new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7; return addDays(d, -wd); };
const monthLabel = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString("uk-UA", { month: "long", year: "numeric" });
const dayLabel = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("uk-UA", { day: "numeric", month: "short", weekday: "short" });

// Плашка поста у формі його формату: Reels/сторіс — вертикальна, карусель/пост — квадрат
function Chip({ p, pillars }: { p: Post; pillars: Pillar[] }) {
  const pl = pillars.find((x) => x.id === p.pillar_id);
  return <span className={`ct-chip f-${p.format} s-${p.status}`} style={{ ["--pc" as string]: pl?.color ?? "var(--dim)" }} title={`${FORMATS[p.format]} · ${POST_STATUS[p.status]}${pl ? ` · ${pl.name}` : ""}`} />;
}

function PostForm({ clientId, pillars, p, date }: { clientId: number; pillars: Pillar[]; p?: Post; date?: string }) {
  const [d, t] = (p?.scheduled_at ?? "").split(" ");
  return (
    <form action={postAction} className="stack" style={{ gap: "0.5rem" }}>
      <input type="hidden" name="client_id" value={clientId} />
      {p && <input type="hidden" name="id" value={p.id} />}
      <input name="topic" defaultValue={p?.topic} placeholder="Тема: напр. «SPA-зона: басейн і дві сауни поруч з домом»" required aria-label="Тема" />
      <input name="hook" defaultValue={p?.hook} placeholder="Хук — перша фраза, яка зупиняє скрол" aria-label="Хук" />
      <div className="ct-row">
        <select name="format" defaultValue={p?.format ?? "carousel"} aria-label="Формат">{Object.entries(FORMATS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select name="pillar_id" defaultValue={p?.pillar_id ?? ""} aria-label="Рубрика"><option value="">Без рубрики</option>{pillars.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
      </div>
      <div className="ct-row">
        <input type="date" name="date" defaultValue={d || date || ""} aria-label="Дата" />
        <input type="time" name="time" defaultValue={t || "18:30"} aria-label="Час" />
      </div>
      <textarea name="note" defaultValue={p?.note} rows={3} placeholder="Нотатка: які рендери взяти, що підкреслити" aria-label="Нотатка" />
      <div className="inline"><SubmitButton className="small">{p ? "Зберегти" : "Додати пост"}</SubmitButton></div>
    </form>
  );
}

// ---------------- Огляд
function Overview({ clientId, s, pillars, posts, base }: { clientId: number; s?: SocialProfile; pillars: Pillar[]; posts: Post[]; base: string }) {
  const counts = statusCounts(clientId);
  const ac = Object.values(assetCounts(clientId)).reduce((a, n) => a + n, 0);
  const share = pillars.reduce((a, p) => a + p.share, 0);
  const today = kyivToday();
  const steps: [string, boolean, string, string][] = [
    ["Куди публікуємо", !!s?.page_id, "Сторінка Facebook і Instagram клієнта", "settings"],
    ["Матеріали", ac > 0, ac ? `${ac} файлів з Диску` : "Папка Google Диска з рендерами, плануваннями, лого", "assets"],
    ["Стратегія", !!(s?.audience && s?.voice), "Для кого пишемо, яким тоном, CTA, що заборонено", "strategy"],
    ["Рубрики", pillars.length >= 3 && share === 100, pillars.length ? `${pillars.length} рубрик · разом ${share}%` : "3–5 тем, на яких тримається стрічка", "strategy"],
    ["Ритм", Object.keys(slotsOf(s)).length > 0, "Скільки Reels, каруселей, сторіс на тиждень і о котрій", "settings"],
    ["Перший план", posts.some((p) => p.scheduled_at && p.scheduled_at >= today), "Пости на найближчі 2 тижні", "plan"],
  ];
  const doneN = steps.filter((x) => x[1]).length;
  const next = posts.filter((p) => p.scheduled_at && p.scheduled_at >= today && p.status !== "rejected").slice(0, 6);
  const tpls = listTemplates();
  return (
    <div className="stack" style={{ gap: "1rem" }}>
      <div className="ct-flow" role="list" aria-label="Конвеєр постів">
        {PIPELINE.map((st) => (
          <Link key={st} href={`${base}&cv=posts`} role="listitem" className={`ct-st${st === "review" && counts[st] ? " hot" : ""}${counts[st] ? "" : " zero"}`}>
            <b>{counts[st] ?? 0}</b><span>{POST_STATUS[st]}</span>
          </Link>
        ))}
      </div>
      <div className="ct-two">
        {doneN < steps.length ? (
          <section className="card stack ct-launch" style={{ gap: "0.5rem" }}>
            <div className="ct-head"><b>Запуск клієнта</b><span className="mono">{doneN} з {steps.length}</span></div>
            <ol>
              {steps.map(([t, ok, d, v]) => (
                <li key={t} className={ok ? "ok" : ""}><Link href={`${base}&cv=${v}`}><b>{t}</b><span className="mono">{d}</span></Link></li>
              ))}
            </ol>
          </section>
        ) : (
          <section className="card stack" style={{ gap: "0.375rem" }}><b>Клієнт запущений</b><span className="mono">Усі кроки налаштування пройдені — далі працює план.</span></section>
        )}
        <section className="card stack" style={{ gap: "0.5rem" }}>
          <div className="ct-head"><b>Найближчі пости</b><Link href={`${base}&cv=plan`} className="h-link mono">календар</Link></div>
          {next.length ? next.map((p) => (
            <div key={p.id} className="ct-line"><Chip p={p} pillars={pillars} /><span className="grow">{p.topic}</span><span className="mono">{dayLabel(p.scheduled_at!.slice(0, 10))} {p.scheduled_at!.slice(11)}</span></div>
          )) : <p className="mono" style={{ margin: 0 }}>Порожньо. Почни з плану: відкрий календар і додай пости на тиждень.</p>}
        </section>
      </div>
      <section className="card stack" style={{ gap: "0.5rem" }}>
        <div className="ct-head"><b>Шаблони</b><span className="mono">спільні для всіх клієнтів · {tpls.filter((t) => t.status === "active").length} робочих</span></div>
        <div className="ct-tpls">
          {tpls.map((t) => (
            <div key={t.key} className={`ct-tpl t-${t.status}`}>
              <span className={`ct-chip f-${t.format}`} style={{ ["--pc" as string]: "var(--accent)" }} />
              <div className="grow"><b>{t.name}</b><span className="mono">{t.description}</span></div>
              <span className={`tag${t.status === "active" ? " ok" : ""}`}>{TPL_STATUS[t.status]}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ---------------- План (календар місяця)
function Plan({ clientId, s, pillars, cm, base }: { clientId: number; s?: SocialProfile; pillars: Pillar[]; cm?: string; base: string }) {
  const today = kyivToday();
  const month = /^\d{4}-\d{2}$/.test(cm ?? "") ? cm! : today.slice(0, 7);
  const first = `${month}-01`;
  const start = mondayOf(first);
  const nextMonth = addDays(`${month}-28`, 7).slice(0, 7), prevMonth = addDays(first, -1).slice(0, 7);
  const weeks: string[] = [];
  for (let w = start; w.slice(0, 7) <= month; w = addDays(w, 7)) weeks.push(w);
  const end = addDays(weeks.at(-1)!, 7);
  const posts = postsBetween(clientId, start, end);
  const themes = weekThemes(clientId, start, end);
  const slots = slotsOf(s), cad = cadenceOf(s);
  const hid = <input type="hidden" name="client_id" value={clientId} />;
  return (
    <div className="stack" style={{ gap: "0.75rem" }}>
      <div className="ct-head">
        <Link href={`${base}&cv=plan&cm=${prevMonth}`} className="btn ghost small" aria-label="Попередній місяць">‹</Link>
        <b className="ct-month">{monthLabel(month)}</b>
        <Link href={`${base}&cv=plan&cm=${nextMonth}`} className="btn ghost small" aria-label="Наступний місяць">›</Link>
        <span className="grow" />
        <span className="ct-legend">{pillars.map((p) => <span key={p.id}><i style={{ background: p.color }} />{p.name}</span>)}</span>
      </div>
      <div className="ct-cal">
        <div className="ct-cal-h"><span>Тема тижня</span>{WEEKDAYS.map((d, i) => <span key={d}>{d}{slots[String(i + 1)] ? <em>{slots[String(i + 1)]}</em> : null}</span>)}</div>
        {weeks.map((w) => {
          const wp = posts.filter((p) => p.scheduled_at! >= w && p.scheduled_at! < addDays(w, 7));
          const by = (f: Format) => wp.filter((p) => p.format === f).length;
          return (
            <div key={w} className="ct-week">
              <div className="ct-theme">
                <Pop className="pop-trigger pop-inline" closeOnSubmit title={`Тема тижня з ${dayLabel(w)}`} trigger={<span className={themes[w] ? "" : "muted"}>{themes[w] || "+ тема"}</span>}>
                  <form action={weekThemeAction} className="stack" style={{ gap: "0.5rem" }}>{hid}<input type="hidden" name="week" value={w} />
                    <input name="theme" defaultValue={themes[w] ?? ""} placeholder="напр. «Життя з SPA поруч»" aria-label="Тема тижня" /><div><SubmitButton className="small">Зберегти</SubmitButton></div>
                  </form>
                </Pop>
                <span className="ct-cad" title="Заплановано / ціль на тиждень">{(Object.keys(FORMATS) as Format[]).filter((f) => cad[f]).map((f) => <span key={f} className={by(f) >= cad[f] ? "ok" : ""}>{FORMATS[f]} {by(f)}/{cad[f]}</span>)}</span>
              </div>
              {Array.from({ length: 7 }, (_, i) => {
                const d = addDays(w, i), dp = wp.filter((p) => p.scheduled_at!.startsWith(d));
                return (
                  <div key={d} className={`ct-day${d.slice(0, 7) !== month ? " out" : ""}${d === today ? " today" : ""}${slots[String(i + 1)] ? " slot" : ""}`}>
                    <span className="ct-dn">{Number(d.slice(8))}</span>
                    {dp.map((p) => (
                      <Pop key={p.id} className="pop-trigger pop-inline ct-cp" closeOnSubmit title={p.topic} trigger={<><Chip p={p} pillars={pillars} /><span className="ct-ct">{p.topic}</span></>}>
                        <PostForm clientId={clientId} pillars={pillars} p={p} />
                      </Pop>
                    ))}
                    <Pop className="pop-trigger pop-inline ct-add" closeOnSubmit title={`Пост на ${dayLabel(d)}`} trigger={<span aria-label={`Додати пост на ${d}`}>+</span>}>
                      <PostForm clientId={clientId} pillars={pillars} date={d} />
                    </Pop>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------- Пости (дошка за статусами)
function Posts({ clientId, pillars, posts }: { clientId: number; pillars: Pillar[]; posts: Post[] }) {
  const cols = [...PIPELINE, "failed", "rejected"] as const;
  return (
    <div className="ct-board">
      {cols.map((st) => {
        const list = posts.filter((p) => p.status === st);
        if ((st === "failed" || st === "rejected") && !list.length) return null;
        return (
          <section key={st} className="ct-col">
            <div className="ct-head"><b>{POST_STATUS[st]}</b><span className="mono">{list.length}</span></div>
            {st === "idea" && (
              <Pop className="pop-trigger pop-inline ct-newpost" closeOnSubmit title="Нова ідея поста" trigger={<span>+ ідея</span>}>
                <PostForm clientId={clientId} pillars={pillars} />
              </Pop>
            )}
            {list.map((p) => (
              <Pop key={p.id} className="pop-card ct-card" closeOnSubmit title={p.topic} trigger={
                <><Chip p={p} pillars={pillars} /><span className="grow"><b>{p.topic}</b><span className="mono">{FORMATS[p.format]}{p.scheduled_at ? ` · ${dayLabel(p.scheduled_at.slice(0, 10))}` : ""}</span></span></>
              }>
                <PostForm clientId={clientId} pillars={pillars} p={p} />
                <div className="ct-status">
                  {(Object.keys(POST_STATUS) as (keyof typeof POST_STATUS)[]).map((k) => (
                    <form key={k} action={postAction}><input type="hidden" name="client_id" value={clientId} /><input type="hidden" name="id" value={p.id} /><input type="hidden" name="op" value="status" /><input type="hidden" name="status" value={k} /><button className={`small${k === p.status ? "" : " ghost"}`}>{POST_STATUS[k]}</button></form>
                  ))}
                  <span className="grow" />
                  <form action={postAction}><input type="hidden" name="client_id" value={clientId} /><input type="hidden" name="id" value={p.id} /><input type="hidden" name="op" value="delete" /><button className="ghost small danger-text">Видалити</button></form>
                </div>
              </Pop>
            ))}
          </section>
        );
      })}
    </div>
  );
}

// ---------------- Матеріали (Диск)
function Assets({ clientId, s, ak, base }: { clientId: number; s?: SocialProfile; ak?: string; base: string }) {
  const all = listAssets(clientId);
  const counts = assetCounts(clientId);
  const list = ak && ak in ASSET_KINDS ? all.filter((a) => a.kind === ak) : all;
  const res = getSetting(`content.sync.${clientId}`) ?? "";
  const problem = !s?.drive_folder_id ? "Вкажи папку з матеріалами в «Налаштуваннях»." : !googleConnected() ? "Google не підключено: Налаштування → Конектори → Google → «Перепідключити»." : !driveReadAll() ? "Google підключено без читання Диску: перепідключи і постав усі галочки." : "";
  const hid = <input type="hidden" name="client_id" value={clientId} />;
  return (
    <div className="stack" style={{ gap: "0.75rem" }}>
      <div className="ct-head" style={{ flexWrap: "wrap" }}>
        {!problem && <form action={syncAssetsAction}>{hid}<SubmitButton className="small" pendingText="Оновлюю…">Оновити з Диску</SubmitButton></form>}
        {s?.drive_folder_url && <a href={s.drive_folder_url} target="_blank" rel="noreferrer" className="btn ghost small">Папка на Диску</a>}
        <span className="mono">{s?.assets_synced_at ? `оновлено ${new Date(s.assets_synced_at).toLocaleString("uk-UA", { timeZone: "Europe/Kyiv", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : "ще не оновлювали"}</span>
        <span className="grow" />
        <nav className="ct-kinds" aria-label="Тип матеріалів">
          <Link href={`${base}&cv=assets`} className={!ak ? "on" : ""}>Усі {all.length}</Link>
          {(Object.keys(ASSET_KINDS) as (keyof typeof ASSET_KINDS)[]).filter((k) => counts[k]).map((k) => <Link key={k} href={`${base}&cv=assets&ak=${k}`} className={ak === k ? "on" : ""}>{ASSET_KINDS[k]} {counts[k]}</Link>)}
        </nav>
      </div>
      {problem && <div className="mx-warn">{problem}</div>}
      {res.startsWith("err:") && <div className="mx-warn">Останнє оновлення не вдалось: {res.slice(4)}</div>}
      {list.length ? (
        <div className="ct-grid">
          {list.map((a) => <AssetTile key={a.id} a={a} clientId={clientId} />)}
        </div>
      ) : !problem && <p className="mono">Файлів ще нема — натисни «Оновити з Диску».</p>}
    </div>
  );
}

function AssetTile({ a, clientId }: { a: Asset; clientId: number }) {
  return (
    <Pop className="pop-card ct-tile" closeOnSubmit title={a.name} trigger={
      <>
        <span className="ct-thumb"><FileThumb src={`/api/content/thumb/${a.id}`} name={a.name} mime={a.mime} /></span>
        <span className="ct-tile-b"><span className="tag">{ASSET_KINDS[a.kind]}</span><span className="ct-name">{a.name}</span></span>
      </>
    }>
      <form action={assetAction} className="stack" style={{ gap: "0.5rem" }}>
        <input type="hidden" name="client_id" value={clientId} /><input type="hidden" name="id" value={a.id} />
        <div className="mono">{a.path ? `${a.path} / ` : ""}{a.name}</div>
        <select name="kind" defaultValue={a.kind} aria-label="Тип">{Object.entries(ASSET_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <input name="tags" defaultValue={a.tags} placeholder="теги через кому: басейн, вечір, фасад, 2к" aria-label="Теги" />
        <div className="inline"><SubmitButton className="small">Зберегти</SubmitButton>{a.link && <a href={a.link} target="_blank" rel="noreferrer" className="btn ghost small">Відкрити на Диску</a>}</div>
      </form>
      <form action={assetAction} style={{ marginTop: "0.5rem" }}>
        <input type="hidden" name="client_id" value={clientId} /><input type="hidden" name="id" value={a.id} /><input type="hidden" name="hidden" value="1" />
        <button className="ghost small">Не використовувати в постах</button>
      </form>
    </Pop>
  );
}

// ---------------- Стратегія
function Strategy({ clientId, s, pillars }: { clientId: number; s?: SocialProfile; pillars: Pillar[] }) {
  const hid = <input type="hidden" name="client_id" value={clientId} />;
  const colors = listColors(clientId);
  const share = pillars.reduce((a, p) => a + p.share, 0);
  const fields: [keyof SocialProfile, string, string, boolean][] = [
    ["audience", "Для кого пишемо", "Хто купує: вік, звідки, що болить, чого хоче. Напр.: сім’ї 28–45 з Тячева і району, хочуть свій простір без переплати за Ужгород.", false],
    ["voice", "Тон", "Як звучимо: впевнено, сучасно, про якість життя, а не про квадрати. Тільки українська.", false],
    ["cta", "Заклик (CTA)", "Що людина робить після поста: «Запишіться на перегляд», «Напишіть у дірект». По одному в рядку.", true],
    ["banned", "Заборонено", "Чого не робимо ніколи: не домальовуємо квартири і двір, не обіцяємо терміни без підтвердження. По одному в рядку.", true],
    ["facts", "Факти (джерело правди)", "Цифри, які можна казати: поверхи, кількість квартир, площі, SPA, паркінг. Тільки перевірене. По одному в рядку.", true],
  ];
  return (
    <div className="stack" style={{ gap: "1rem" }}>
      <div className="eb-grid">
        {fields.map(([k, t, hint, list]) => <EditBlock key={k} title={t} name={k} value={String(s?.[k] ?? "")} list={list} hint={hint} action={saveSocialAction} hidden={hid} rows={list ? 8 : 5} />)}
        <div className="card stack" style={{ gap: "0.375rem" }}>
          <b>Брендбук</b>
          {colors.length ? <div className="ct-swatches">{colors.map((c) => <span key={c.id} title={`${c.name || c.role} ${c.hex}`} style={{ background: c.hex }} />)}</div> : <span className="mono">Кольорів ще нема.</span>}
          <Link href={`/clients/${clientId}?tab=brand`} className="h-link mono">Кольори, шрифти, лого — у брендбуку</Link>
        </div>
      </div>
      <section className="card stack" style={{ gap: "0.625rem" }}>
        <div className="ct-head"><b>Рубрики</b><span className="mono" style={share !== 100 && pillars.length ? { color: "var(--bad)" } : undefined}>разом {share}%{share !== 100 && pillars.length ? " — має бути 100" : ""}</span></div>
        {pillars.length > 0 && <div className="ct-share" aria-hidden>{pillars.map((p) => <i key={p.id} style={{ flexGrow: p.share || 1, background: p.color }} />)}</div>}
        {pillars.map((p) => (
          <Pop key={p.id} className="pop-card ct-pillar" closeOnSubmit title={p.name} trigger={<><i style={{ background: p.color }} /><span className="grow"><b>{p.name}</b><span className="mono">{p.goal || "мета не вказана"}</span></span><span className="mono">{p.share}%</span></>}>
            <PillarForm clientId={clientId} p={p} />
            <form action={pillarAction} style={{ marginTop: "0.5rem" }}>{hid}<input type="hidden" name="id" value={p.id} /><input type="hidden" name="op" value="archive" /><button className="ghost small danger-text">Прибрати рубрику</button></form>
          </Pop>
        ))}
        <Pop className="pop-trigger pop-inline" closeOnSubmit title="Нова рубрика" trigger={<span className="h-link">+ рубрика</span>}><PillarForm clientId={clientId} /></Pop>
        {!pillars.length && <p className="mono" style={{ margin: 0 }}>Рубрика — постійна тема стрічки. Напр. для ЖК: «SPA і відпочинок», «Планування», «Хід будівництва», «Життя в Тячеві», «Умови покупки». 3–5 штук, разом 100%.</p>}
      </section>
    </div>
  );
}

function PillarForm({ clientId, p }: { clientId: number; p?: Pillar }) {
  return (
    <form action={pillarAction} className="stack" style={{ gap: "0.5rem" }}>
      <input type="hidden" name="client_id" value={clientId} />{p && <input type="hidden" name="id" value={p.id} />}
      <input name="name" defaultValue={p?.name} placeholder="Назва: напр. «SPA і відпочинок»" required aria-label="Назва" />
      <input name="goal" defaultValue={p?.goal} placeholder="Навіщо: напр. показати головну перевагу, яку нема в конкурентів" aria-label="Мета" />
      <div className="ct-row">
        <label className="ct-lbl">Колір<input type="color" name="color" defaultValue={p?.color ?? "#2d8a52"} /></label>
        <label className="ct-lbl">Частка, %<input type="number" name="share" min={0} max={100} defaultValue={p?.share ?? 20} /></label>
      </div>
      <div><SubmitButton className="small">{p ? "Зберегти" : "Додати"}</SubmitButton></div>
    </form>
  );
}

// ---------------- Налаштування
async function Settings({ clientId, s }: { clientId: number; s?: SocialProfile }) {
  const check = metaToken() ? await metaTokenCheck() : null;
  const pages = check?.ok ? check.pages ?? [] : [];
  const hid = <input type="hidden" name="client_id" value={clientId} />;
  const cad = cadenceOf(s), slots = slotsOf(s);
  return (
    <div className="ct-settings">
      <section className="card stack" style={{ gap: "0.5rem" }}>
        <b>Куди публікуємо</b>
        <span className="mono">{s?.page_id ? `Facebook: ${s.page_name}${s.ig_username ? ` · Instagram: @${s.ig_username}` : " · Instagram не привʼязаний до сторінки"}` : "Обери сторінку клієнта — Instagram підтягнеться з неї."}</span>
        {pages.length ? (
          <form action={saveSocialAction} className="ct-row">{hid}
            <select key={s?.page_id || "none"} name="page" defaultValue={s?.page_id ? `${s.page_id}|${s.ig_id}|${s.ig_username}|${s.page_name}` : ""} aria-label="Сторінка">
              <option value="" disabled>Обери сторінку</option>
              {pages.map((p) => <option key={p.id} value={`${p.id}|${p.ig}|${p.igUser}|${p.name}`}>{p.name}{p.igUser ? ` · @${p.igUser}` : " · без Instagram"}</option>)}
            </select>
            <SubmitButton className="small">Зберегти</SubmitButton>
          </form>
        ) : <div className="mx-warn">Токен Meta не бачить сторінок: Налаштування → Конектори → Meta Ads.</div>}
      </section>
      <section className="card stack" style={{ gap: "0.5rem" }}>
        <b>Папка з матеріалами</b>
        <span className="mono">Google Диск: рендери, планування, лого, фото. Пости збираються тільки з цих файлів.</span>
        <form action={saveSocialAction} className="ct-row">{hid}
          <input key={s?.drive_folder_url || "none"} name="drive" defaultValue={s?.drive_folder_url ?? ""} placeholder="https://drive.google.com/drive/folders/…" inputMode="url" autoCapitalize="off" aria-label="Папка на Диску" />
          <SubmitButton className="small">Зберегти</SubmitButton>
        </form>
        {s?.drive_folder_url && !s.drive_folder_id && <div className="mx-warn">Це не схоже на посилання на папку — скопіюй адресу відкритої папки з браузера.</div>}
      </section>
      <section className="card stack" style={{ gap: "0.5rem" }}>
        <b>Апрув</b>
        <form action={saveSocialAction} className="stack" style={{ gap: "0.5rem" }}>{hid}
          <label className="ct-radio"><input type="radio" name="approval" value="manual" defaultChecked={(s?.approval ?? "manual") === "manual"} /><span><b>Тільки після мого ✓</b><span className="mono">Без відповіді пост не виходить.</span></span></label>
          <label className="ct-radio"><input type="radio" name="approval" value="auto" defaultChecked={s?.approval === "auto"} /><span><b>Виходить сам, якщо мовчу</b><span className="mono">Тільки робочі шаблони, через <input type="number" name="auto_hours" min={1} max={168} defaultValue={s?.auto_hours ?? 24} className="ct-num" aria-label="Годин" /> год без відповіді.</span></span></label>
          <div><SubmitButton className="small">Зберегти</SubmitButton></div>
        </form>
      </section>
      <section className="card stack" style={{ gap: "0.5rem" }}>
        <b>Ритм на тиждень</b>
        <form action={saveSocialAction} className="stack" style={{ gap: "0.625rem" }}>{hid}<input type="hidden" name="slots_form" value="1" />
          <div className="ct-cadence">{(Object.keys(FORMATS) as Format[]).map((f) => <label key={f} className="ct-lbl">{FORMATS[f]}<input type="number" name={`cad_${f}`} min={0} max={21} defaultValue={cad[f]} /></label>)}</div>
          <div className="ct-slots">
            {WEEKDAYS.map((d, i) => (
              <label key={d} className="ct-slot"><input type="checkbox" name={`day_${i + 1}`} defaultChecked={!!slots[String(i + 1)]} /><span>{d}</span><input type="time" name={`slot_${i + 1}`} defaultValue={slots[String(i + 1)] ?? "18:30"} aria-label={`Час, ${d}`} /></label>
            ))}
          </div>
          <span className="mono">Дні й час публікації постів у стрічку (Київ). Сторіс — у ті самі дні.</span>
          <div><SubmitButton className="small">Зберегти</SubmitButton></div>
        </form>
      </section>
    </div>
  );
}

export default async function ContentTab({ clientId, cv, cm, ak }: { clientId: number; cv?: string; cm?: string; ak?: string }) {
  const view: View = (VIEWS.find(([k]) => k === cv)?.[0] ?? "overview") as View;
  const s = getSocial(clientId);
  const pillars = listPillars(clientId);
  const posts = listPosts(clientId);
  const base = `/clients/${clientId}?tab=content`;
  const review = posts.filter((p) => p.status === "review").length;
  return (
    <div className="stack ct" style={{ gap: "1rem" }}>
      <div className="ct-top">
        <div className="grow">
          <span className="mono">{s?.ig_username ? `@${s.ig_username}` : "Instagram не обрано"}{s?.page_name ? ` і ${s.page_name}` : ""}{s?.approval === "auto" ? ` · авто через ${s.auto_hours} год` : " · публікація після ✓"}</span>
        </div>
        <Pop className="pop-trigger pop-inline" closeOnSubmit title="Нова ідея поста" trigger={<span className="btn small">+ Пост</span>}><PostForm clientId={clientId} pillars={pillars} /></Pop>
      </div>
      <nav className="mx-tabs" aria-label="Розділи студії">
        {VIEWS.map(([k, l]) => <Link key={k} href={k === "overview" ? base : `${base}&cv=${k}`} className={view === k ? "on" : ""} scroll={false}>{l}{k === "posts" && review ? <span className="count">{review}</span> : null}</Link>)}
      </nav>
      {view === "overview" && <Overview clientId={clientId} s={s} pillars={pillars} posts={posts} base={base} />}
      {view === "plan" && <Plan clientId={clientId} s={s} pillars={pillars} cm={cm} base={base} />}
      {view === "posts" && <Posts clientId={clientId} pillars={pillars} posts={posts} />}
      {view === "assets" && <Assets clientId={clientId} s={s} ak={ak} base={base} />}
      {view === "strategy" && <Strategy clientId={clientId} s={s} pillars={pillars} />}
      {view === "settings" && <Settings clientId={clientId} s={s} />}
    </div>
  );
}
