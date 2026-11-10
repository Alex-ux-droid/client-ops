// Пульс сайту: що роблять люди на сайті (з /api/site/<ключ>). Не підключено — інструкція і промпт для Claude Code сайту.
import ListPop from "./ListPop";
import { CopyText } from "@/app/startups/[id]/CopyText";
import { ProductPrompt } from "@/app/products/ProductClient";
import { siteKey, sitePulse } from "@/lib/sitePulse";
import { fmtDate } from "@/lib/dates";

const SRC: Record<string, string> = { facebook: "Facebook", instagram: "Instagram", google: "Google", direct: "Напряму" };
const srcName = (k: string) => SRC[k] ?? k.replace(/^referral:/, "з ");
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

export default function SitePulseCard({ productId, days = 7 }: { productId: number; days?: number }) {
  const s = sitePulse(productId, days);
  const connect = (
    <div className="stack" style={{ gap: "0.5rem" }}>
      <div className="mono">1) «Промпт: підключити» → встав у чат Claude Code цього сайту. 2) Додай у Cloudflare секрет <b>SITE_PULSE_KEY</b> з цим значенням і передеплой:</div>
      <div className="inline" style={{ flexWrap: "wrap" }}><code className="sp-key">{siteKey(productId)}</code><CopyText text={siteKey(productId)} label="Копіювати ключ" /></div>
      <div className="inline" style={{ flexWrap: "wrap" }}><ProductPrompt productId={productId} mode="site" primary label="Промпт: підключити пульс" /></div>
    </div>
  );
  if (!s.last) return (
    <div className="card stack" style={{ gap: "0.5rem" }}>
      <b>Пульс сайту · не підключено</b>
      <div className="mono">Скільки людей заходить і звідки, що натискають, хто почав і кинув форму, помилки на сторінці — без особистих даних.</div>
      {connect}
    </div>
  );
  const ads = s.sources.filter((x) => x.k === "facebook" || x.k === "instagram").reduce((a, x) => a + x.n, 0);
  return (
    <div className="card stack" style={{ gap: "0.75rem" }}>
      <div className="sd-head"><b>Пульс сайту · {days} дн.</b><span className="mono">остання подія {fmtDate(s.last)} {s.last.slice(11, 16)} UTC</span></div>
      <div className="spl-kpis">
        <div><b>{s.sessions}</b><span>відвідувань · з телефону {pct(s.mobile, s.sessions)}%</span></div>
        <div><b>{ads}</b><span>з реклами Meta ({pct(ads, s.sessions)}%)</span></div>
        <div><b>{s.contacts}</b><span>натиснули телефон / месенджер</span></div>
        <div className={s.forms.start && pct(s.forms.success, s.forms.start) < 30 ? "bad" : ""}><b>{s.forms.start} → {s.forms.success}</b><span>форма: почали → відправили ({pct(s.forms.success, s.forms.start)}%)</span></div>
      </div>
      <div className="qt-grid">
        <ListPop title="Звідки приходять" ico="compass" items={s.sources.map((x) => `${srcName(x.k)} — ${x.n}`)} empty="ще нема" />
        <ListPop title="Що натискають" ico="sparkles" tone="accent" items={s.clicks.map((x) => `${x.k} — ${x.n}`)} empty="ще нема кліків" />
        <ListPop title="Сторінки" ico="file" items={s.pages.map((x) => `${x.k} — ${x.n}`)} empty="ще нема" />
        <ListPop title="Глибина гортання" ico="layers" items={s.scroll.map((x) => `до ${x.k}% — ${x.n}`)} empty="ще нема" />
        {s.forms.errors.length > 0 && <ListPop title="Де спотикаються у формі" ico="alert" tone="bad" items={s.forms.errors.map((x) => `${x.k} — ${x.n}`)} />}
        {s.jsErrors.length > 0 && <ListPop title="Помилки на сторінці" ico="alert" tone="bad" items={s.jsErrors.map((x) => `${x.k} ×${x.n}`)} />}
      </div>
      <details><summary className="h-link">Підключення</summary><div style={{ marginTop: "0.5rem" }}>{connect}</div></details>
    </div>
  );
}
