// Студія контенту клієнта: Огляд (конвеєр + запуск) · План (календар місяця) · Пости (дошка) · Матеріали (Диск) · Стратегія · Налаштування.
// Модель: рубрики і стратегія → план по тижнях → пост (шаблон + слоти) → рендер → апрув → публікація. Візуал — тільки реальні матеріали клієнта.
import Link from "next/link";
import EditBlock from "@/components/EditBlock";
import FileThumb from "@/components/FileThumb";
import Pop from "@/components/Pop";
import SubmitButton from "@/components/SubmitButton";
import { analyzeSocialAction, approvalAction, assetAction, refreshSocialAction, checkPublishAction, fillStoryAction, paletteAction, pillarAction, postAction, saveSocialAction, storySpecAction, syncAssetsAction, weekThemeAction } from "@/app/content/actions";
import { isCarousel, mediaKey, paletteOf, slideCount, specOf } from "@/lib/contentPipeline";
import { getAnalysis, getSnapshot, stats, type Snapshot } from "@/lib/socialAnalysis";
import { driveReadAll, googleConnected } from "@/lib/google";
import { metaToken, metaTokenCheck } from "@/lib/meta";
import { listColors } from "@/lib/repo/brand";
import { ASSET_KINDS, PIPELINE, POST_STATUS, TPL_STATUS, assetCounts, listAssets, listPillars, listPosts, listTemplates, postsBetween, statusCounts, weekThemes, type Asset, type Pillar, type Post } from "@/lib/repo/content";
import { getSetting } from "@/lib/repo/settings";
import { FORMATS, WEEKDAYS, cadenceOf, getSocial, slotsOf, type Format, type SocialProfile } from "@/lib/repo/social";

const VIEWS = [
  ["overview", "Огляд"], ["analysis", "Аналіз"], ["plan", "План"], ["posts", "Пости"], ["assets", "Матеріали"], ["strategy", "Стратегія"], ["settings", "Налаштування"],
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

// ---------------- Аналіз акаунтів: цифри профілю, формати, останні пости, розбір Джері
const fmtN = (n: number | null | undefined) => (n == null ? "—" : n >= 10000 ? `${Math.round(n / 1000)}k` : n.toLocaleString("uk-UA"));
function NetBlock({ sn, label }: { sn: Snapshot | null; label: string }) {
  const st = stats(sn);
  if (!sn) return <section className="card"><b>{label}</b><p className="mono">Ще не завантажено — «Оновити».</p></section>;
  return (
    <section className="card stack" style={{ gap: "0.75rem" }}>
      <div className="ct-head"><b>{label}</b><span className="mono">{sn.profile.name}</span>{sn.error && <span className="tag bad" title={sn.error}>помилка</span>}</div>
      {sn.error && <div className="mx-warn">{sn.error}</div>}
      {st && <div className="an-kpis">
        <div><b>{fmtN(sn.profile.followers)}</b><span>підписників</span></div>
        <div><b>{st.posts30}</b><span>постів за 30 дн.</span></div>
        <div><b>{fmtN(st.reach)}</b><span>охоплення / пост</span></div>
        <div><b>{st.er != null ? `${st.er}%` : "—"}</b><span>залученість</span></div>
      </div>}
      {st && st.byType.length > 0 && (
        <div className="an-types">{st.byType.map((t) => (
          <div key={t.type}><b>{t.type}</b><span className="mono">{t.n} шт. · охоплення {fmtN(t.reach)} · дій {fmtN(t.eng)}{t.saves != null ? ` · збер. ${fmtN(t.saves)}` : ""}</span></div>
        ))}</div>
      )}
      {sn.posts.length > 0 && (
        <div className="an-posts">{sn.posts.slice(0, 12).map((p) => (
          <a key={p.id} href={p.url} target="_blank" rel="noreferrer" className="an-post" title={p.caption}>
            <span className="an-thumb">{p.thumb ? <img src={p.thumb} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span className="mono">{p.type}</span>}<em>{p.type}</em></span>
            <span className="an-nums"><b>{fmtN(p.reach ?? p.likes)}</b> {p.reach != null ? "охопл." : "реакц."} · {p.saves != null ? `${fmtN(p.saves)} збер. · ` : ""}{p.comments} ком.</span>
            <span className="mono an-date">{new Date(p.date).toLocaleDateString("uk-UA", { day: "numeric", month: "short" })}</span>
          </a>
        ))}</div>
      )}
    </section>
  );
}
function Analysis({ clientId, s }: { clientId: number; s?: SocialProfile }) {
  const ig = getSnapshot(clientId, "ig"), fb = getSnapshot(clientId, "fb"), a = getAnalysis(clientId);
  const err = getSetting(`content.analysis_err.${clientId}`) ?? "";
  const hid = <input type="hidden" name="client_id" value={clientId} />;
  const at = ig?.fetched_at ?? fb?.fetched_at;
  return (
    <div className="stack" style={{ gap: "1rem" }}>
      <div className="ct-head" style={{ flexWrap: "wrap" }}>
        <form action={refreshSocialAction}>{hid}<SubmitButton className="small" pendingText="Тягну з Meta…">Оновити</SubmitButton></form>
        <form action={analyzeSocialAction}>{hid}<SubmitButton className="ghost small" pendingText="Джері розбирає…">Розібрати акаунти</SubmitButton></form>
        <span className="mono">{at ? `дані на ${new Date(at.replace(" ", "T") + "Z").toLocaleString("uk-UA", { timeZone: "Europe/Kyiv", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : "ще не завантажували"}</span>
        {!s?.page_id && <span className="mx-warn">Спершу обери сторінку в «Налаштуваннях»</span>}
      </div>
      {err && <div className="mx-warn">{err}</div>}
      {a && (
        <section className="card stack an-verdict" style={{ gap: "0.625rem" }}>
          <div className="ct-head"><b>Висновок Джері</b><span className="mono">{new Date(a.at).toLocaleDateString("uk-UA", { day: "numeric", month: "short" })}</span></div>
          <p style={{ margin: 0 }}>{a.summary}</p>
          <div className="an-cols">
            <div><b className="ok-text">Заходить</b><ul>{a.works.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
            <div><b className="bad-text2">Не заходить</b><ul>{a.weak.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
            <div><b>3 дії на місяць</b><ol>{a.actions.map((x, i) => <li key={i}>{x}</li>)}</ol></div>
          </div>
        </section>
      )}
      <NetBlock sn={ig} label="Instagram" />
      <NetBlock sn={fb} label="Facebook" />
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
                      <Pop key={p.id} className="pop-trigger pop-inline ct-cp" wide={hasEditor(p)} title={p.topic} trigger={<><Chip p={p} pillars={pillars} /><span className="ct-ct">{p.topic}</span></>}>
                        <PostEditor clientId={clientId} p={p} />
                        <details className="ct-more" open={!hasEditor(p)}><summary className="mono">Тема, формат, дата</summary><PostForm clientId={clientId} pillars={pillars} p={p} /></details>
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

// ---------------- Редактор каруселі «Фішка»: кадри з матеріалів (перший — обкладинка) + тези → «Зібрати» → слайди → апрув
const hasEditor = (p: Post) => p.template_key === "story-fact" || isCarousel(p);
function PostEditor({ clientId, p }: { clientId: number; p: Post }) {
  return isCarousel(p) ? <CarouselEditor clientId={clientId} p={p} /> : p.template_key === "story-fact" ? <StoryEditor clientId={clientId} p={p} /> : null;
}
function CarouselEditor({ clientId, p }: { clientId: number; p: Post }) {
  const spec = specOf(p);
  const all = listAssets(clientId).filter((a) => a.mime.startsWith("image/") && (a.kind === "render" || a.kind === "photo" || a.kind === "plan"));
  const byId = new Map(all.map((a) => [a.id, a]));
  const slides = [...(spec.slides ?? [])].sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0)).filter((x) => byId.has(x.asset_id));
  const picked = new Set(slides.map((x) => x.asset_id));
  const imgs = [...slides.map((x) => byId.get(x.asset_id)!), ...all.filter((a) => !picked.has(a.id))].slice(0, 120);
  const n = slideCount(p), v = Date.parse(p.media_at ?? "") || 0;
  const hid = <><input type="hidden" name="client_id" value={clientId} /><input type="hidden" name="id" value={p.id} /></>;
  return (
    <div className="stack" style={{ gap: "0.75rem", marginBottom: "0.75rem" }}>
      {p.publish_error && <div className="mx-warn">{p.publish_error}</div>}
      <div className="ct-car-prev">
        {n ? Array.from({ length: n }, (_, i) => <img key={i} src={`/m/${mediaKey(p.id)}${i ? `_${i}` : ""}.jpg?v=${v}`} alt={`Слайд ${i + 1}`} />)
          : <span className="mono">Тут будуть слайди 4:5 після «Зібрати»: обкладинка → слайд на кожен кадр → фінал із закликом.</span>}
      </div>
      <form action={storySpecAction} className="stack" style={{ gap: "0.5rem" }}>
        {hid}
        <span className="mono">1. Кадри: познач 3–7 (перший за № — обкладинка). Тільки реальні рендери й планування.</span>
        <div className="ct-pick">
          {imgs.length ? imgs.map((a) => (
            <label key={a.id} className="ct-pick-i" title={a.name}><input type="checkbox" name="slide_asset" value={a.id} defaultChecked={picked.has(a.id)} /><img src={`/api/content/thumb/${a.id}`} alt={a.name} loading="lazy" />{a.kind === "plan" && <span className="ct-pick-tag">план</span>}</label>
          )) : <span className="mono" style={{ gridColumn: "1 / -1" }}>Нема зображень — Матеріали → «Оновити з Диску».</span>}
        </div>
        <span className="mono">2. Обкладинка</span>
        <input name="kicker" defaultValue={spec.kicker} maxLength={40} placeholder="Кікер: 2–4 слова, напр. «Що всередині»" aria-label="Кікер" />
        <input name="fact" defaultValue={spec.fact} maxLength={70} placeholder="Хук обкладинки до 50 символів" aria-label="Заголовок обкладинки" />
        <input name="sub" defaultValue={spec.sub} maxLength={140} placeholder="Підзаголовок (необовʼязково)" aria-label="Підзаголовок" />
        {slides.length > 0 && <>
          <span className="mono">3. Слайди (№ — порядок; змінив кадри — «Зберегти», щоб зʼявились рядки)</span>
          {slides.map((x, i) => (
            <div key={x.asset_id} className="ct-slide-row">
              <img src={`/api/content/thumb/${x.asset_id}`} alt="" />
              <input type="number" name={`pos_${x.asset_id}`} defaultValue={i + 1} min={1} max={9} aria-label="Порядок" />
              {i === 0 ? <span className="mono">обкладинка</span> : <div className="ct-slide-txt">
                <input name={`title_${x.asset_id}`} defaultValue={x.title} maxLength={80} placeholder="Теза до 55 символів" aria-label={`Теза слайда ${i + 1}`} />
                <input name={`text_${x.asset_id}`} defaultValue={x.text} maxLength={160} placeholder="Пояснення до 110 символів" aria-label={`Пояснення слайда ${i + 1}`} />
              </div>}
            </div>
          ))}
        </>}
        <span className="mono">4. Фінальний слайд і підпис</span>
        <input name="end_title" defaultValue={spec.end_title} maxLength={70} placeholder="Заголовок фіналу, напр. «Хочете побачити наживо?»" aria-label="Заголовок фіналу" />
        <input name="end_text" defaultValue={spec.end_text} maxLength={160} placeholder="Текст фіналу" aria-label="Текст фіналу" />
        <input name="cta" defaultValue={spec.cta} maxLength={30} placeholder="Кнопка: напр. «Записатись на перегляд»" aria-label="CTA" />
        <textarea name="caption" defaultValue={p.caption} maxLength={2200} rows={4} placeholder="Підпис до поста в Instagram (хук, користь, «збережіть», CTA, хештеги)" aria-label="Підпис" />
        <div className="inline" style={{ flexWrap: "wrap" }}>
          <button name="op" value="render" className="small">Зібрати</button>
          <button name="op" value="save" className="ghost small">Зберегти</button>
        </div>
      </form>
      <div className="inline" style={{ flexWrap: "wrap" }}>
        <form action={fillStoryAction}>{hid}<SubmitButton className="ghost small" pendingText="Джері пише…">Джері, заповни тексти</SubmitButton></form>
        {n > 0 && p.status !== "published" && <form action={approvalAction}>{hid}<SubmitButton className="small" pendingText="Надсилаю…">{p.status === "review" ? "Надіслати на ✓ ще раз" : "На апрув у Telegram"}</SubmitButton></form>}
        {p.ig_media_id && <span className="tag ok">вийшло в Instagram</span>}
      </div>
    </div>
  );
}

// ---------------- Редактор сторіс «Факт»: рендер з матеріалів + 4 слоти → «Зібрати» → прев'ю → «На апрув» у Telegram
function StoryEditor({ clientId, p }: { clientId: number; p: Post }) {
  const spec = specOf(p);
  const imgs = listAssets(clientId).filter((a) => a.mime.startsWith("image/") && (a.kind === "render" || a.kind === "photo" || a.kind === "plan")).slice(0, 80);
  const hid = <><input type="hidden" name="client_id" value={clientId} /><input type="hidden" name="id" value={p.id} /></>;
  return (
    <div className="ct-story">
      <div className="ct-story-prev">
        {p.media_path ? <img src={`/m/${mediaKey(p.id)}.jpg?v=${Date.parse(p.media_at ?? "") || 0}`} alt="Готова сторіс" /> : <span className="mono">Тут буде готова сторіс після «Зібрати»</span>}
      </div>
      <div className="stack" style={{ gap: "0.625rem", minWidth: 0 }}>
        {p.publish_error && <div className="mx-warn">{p.publish_error}</div>}
        <form action={storySpecAction} className="stack" style={{ gap: "0.5rem" }}>
          {hid}
          <input name="kicker" defaultValue={spec.kicker} maxLength={40} placeholder="Кікер: 2–3 слова, напр. «SPA-зона»" aria-label="Кікер" />
          <input name="fact" defaultValue={spec.fact} maxLength={70} placeholder="Факт: головна фраза до 40 символів" aria-label="Факт" />
          <input name="sub" defaultValue={spec.sub} maxLength={140} placeholder="Підпис: пояснення до 90 символів" aria-label="Підпис" />
          <input name="cta" defaultValue={spec.cta} maxLength={30} placeholder="CTA: напр. «Записатись на перегляд»" aria-label="CTA" />
          <span className="mono">Рендер {spec.asset_id ? "" : "(обери один)"}</span>
          <div className="ct-pick">
            {imgs.length ? imgs.map((a) => (
              <label key={a.id} className="ct-pick-i" title={a.name}><input type="radio" name="asset_id" value={a.id} defaultChecked={spec.asset_id === a.id} /><img src={`/api/content/thumb/${a.id}`} alt={a.name} loading="lazy" /></label>
            )) : <span className="mono" style={{ gridColumn: "1 / -1" }}>Нема зображень — Матеріали → «Оновити з Диску».</span>}
          </div>
          <div className="inline" style={{ flexWrap: "wrap" }}>
            <button name="op" value="render" className="small">Зібрати</button>
            <button name="op" value="save" className="ghost small">Зберегти</button>
          </div>
        </form>
        <div className="inline" style={{ flexWrap: "wrap" }}>
          <form action={fillStoryAction}>{hid}<SubmitButton className="ghost small" pendingText="Джері пише…">Джері, заповни тексти</SubmitButton></form>
          {p.media_path && p.status !== "published" && <form action={approvalAction}>{hid}<SubmitButton className="small" pendingText="Надсилаю…">{p.status === "review" ? "Надіслати на ✓ ще раз" : "На апрув у Telegram"}</SubmitButton></form>}
          {p.ig_media_id && <span className="tag ok">вийшло в Instagram</span>}
        </div>
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
              <Pop key={p.id} className="pop-card ct-card" wide={hasEditor(p)} title={p.topic} trigger={
                <><Chip p={p} pillars={pillars} /><span className="grow"><b>{p.topic}</b><span className="mono">{FORMATS[p.format]}{p.scheduled_at ? ` · ${dayLabel(p.scheduled_at.slice(0, 10))}` : ""}</span></span></>
              }>
                <PostEditor clientId={clientId} p={p} />
                <details className="ct-more"><summary className="mono">Тема, формат, дата</summary><PostForm clientId={clientId} pillars={pillars} p={p} /></details>
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
  const pal = paletteOf(clientId);
  const check2 = (getSetting(`content.publish_check.${clientId}`) ?? "").split("|").slice(1).join("|");
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
        <b>Публікація</b>
        <span className="mono">Перевірка готує тестову сторіс в Instagram клієнта і нічого не публікує.</span>
        <form action={checkPublishAction}>{hid}<SubmitButton className="small" pendingText="Перевіряю…">Перевірити доступ до публікації</SubmitButton></form>
        {check2 && <div className={check2.startsWith("✓") ? "mono" : "mx-warn"}>{check2}</div>}
      </section>
      <section className="card stack" style={{ gap: "0.5rem" }}>
        <b>Кольори шаблонів</b>
        <span className="mono">Як у каталозі клієнта: основний (заголовки, кнопка), акцент (кікер, хвиля), фон панелі, текст.</span>
        <form action={paletteAction} className="stack" style={{ gap: "0.5rem" }}>{hid}
          <div className="ct-cadence">{(["dark", "accent", "paper", "ink"] as const).map((k) => <label key={k} className="ct-lbl">{{ dark: "Основний", accent: "Акцент", paper: "Фон", ink: "Текст" }[k]}<input type="color" name={k} defaultValue={pal[k]} /></label>)}</div>
          <div><SubmitButton className="small">Зберегти</SubmitButton></div>
        </form>
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
      {view === "analysis" && <Analysis clientId={clientId} s={s} />}
      {view === "plan" && <Plan clientId={clientId} s={s} pillars={pillars} cm={cm} base={base} />}
      {view === "posts" && <Posts clientId={clientId} pillars={pillars} posts={posts} />}
      {view === "assets" && <Assets clientId={clientId} s={s} ak={ak} base={base} />}
      {view === "strategy" && <Strategy clientId={clientId} s={s} pillars={pillars} />}
      {view === "settings" && <Settings clientId={clientId} s={s} />}
    </div>
  );
}
