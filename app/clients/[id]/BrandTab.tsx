// Брендбук клієнта: позиціонування і тон, кольори, шрифти, логотипи й файли. Іде в креативи («Хто ми»), пропозиції і Джері.
import { brandAssetAction, brandColorAction, brandFieldsAction, brandFontAction } from "@/app/brand/actions";
import { CopyText } from "@/app/startups/[id]/CopyText";
import Icon from "@/components/Icon";
import Pop from "@/components/Pop";
import SubmitButton from "@/components/SubmitButton";
import VoiceTextarea from "@/components/VoiceTextarea";
import { brandMd, brandPrompt } from "@/lib/brand";
import { ASSET_KINDS, BRAND_FIELDS, COLOR_ROLES, FONT_ROLES, getBrand, listAssets, listColors, listFonts, type BrandField } from "@/lib/repo/brand";
import { getClient } from "@/lib/repo/clients";
import { BrandImport, BrandUpload, ColorChip } from "./BrandClient";

const isImg = (mime?: string | null, url?: string) => /^image\//.test(mime ?? "") || /\.(png|jpe?g|svg|webp|gif)(\?|$)/i.test(url ?? "");
const kb = (n?: number | null) => (n == null ? "" : n > 1048576 ? `${(n / 1048576).toFixed(1)} МБ` : `${Math.max(1, Math.round(n / 1024))} КБ`);

export default function BrandTab({ clientId }: { clientId: number }) {
  const c = getClient(clientId);
  const b = getBrand(clientId), colors = listColors(clientId), fonts = listFonts(clientId), assets = listAssets(clientId);
  const logo = assets.find((a) => a.kind === "logo" && isImg(a.mime, a.url));
  const logoSrc = logo ? (logo.file_id ? `/api/files/${logo.file_id}` : logo.url) : "";
  const keys = Object.keys(BRAND_FIELDS) as BrandField[];
  const filled = keys.filter((k) => b[k].trim()).length;
  const md = brandMd(clientId);
  const hid = <input type="hidden" name="client_id" value={clientId} />;
  return (
    <div className="stack" style={{ gap: "1rem" }}>
      <div className="card bb-hero">
        <div className="bb-logo">{logoSrc ? <img src={logoSrc} alt="Логотип" /> : <Icon name="sparkles" size={28} />}</div>
        <div className="stack" style={{ gap: "0.375rem", minWidth: 0, flex: 1 }}>
          <b className="bb-name">{c?.name}</b>
          <span className="bb-pos">{b.promise || b.positioning || "Позиціонування ще не заповнене — почни з «Промпт для дизайн-системи» або заповни поля нижче."}</span>
          {colors.length > 0 && <span className="bb-strip">{colors.map((x) => <i key={x.id} style={{ background: x.hex }} title={`${x.name || ""} ${x.hex}`} />)}</span>}
          <span className="mono">Заповнено {filled} з {keys.length} · кольорів {colors.length} · шрифтів {fonts.length} · файлів {assets.length}</span>
        </div>
        <div className="bb-acts">
          <CopyText text={brandPrompt(clientId)} label="Промпт для дизайн-системи" className="small" />
          {md && <CopyText text={`# Брендбук: ${c?.name}\n\n${md}`} label="Скопіювати брендбук" />}
          <Pop wide title="Вставити витяжку бренду" trigger={<span className="h-link">Вставити витяжку</span>}><BrandImport clientId={clientId} /></Pop>
        </div>
      </div>

      <div className="bb-grid">
        {keys.map((k) => (
          <Pop key={k} wide className={`pop-card bb-field${b[k].trim() ? "" : " empty"}`} title={BRAND_FIELDS[k].label} trigger={
            <>
              <span className="qt-h"><span className="qt-t"><b>{BRAND_FIELDS[k].label}</b></span>{!b[k].trim() && <span className="qt-n">порожньо</span>}</span>
              <span className="bb-prev">{b[k].trim() || BRAND_FIELDS[k].hint}</span>
            </>
          }>
            <form action={brandFieldsAction} className="stack" style={{ gap: "0.5rem" }}>
              {hid}
              <span className="mono">{BRAND_FIELDS[k].hint}</span>
              <VoiceTextarea name={k} defaultValue={b[k]} style={{ minHeight: "10rem" }} />
              <div><SubmitButton className="small">Зберегти</SubmitButton></div>
            </form>
          </Pop>
        ))}
      </div>

      <section className="card stack" style={{ gap: "0.75rem" }}>
        <div className="bb-h"><b>Кольори</b><span className="mono">клік по кольору — скопіювати HEX</span></div>
        {colors.length ? <div className="bb-colors">{colors.map((x) => (
          <div key={x.id} className="bb-cwrap">
            <ColorChip hex={x.hex} name={x.name} role={COLOR_ROLES[x.role as keyof typeof COLOR_ROLES] ?? ""} />
            <form action={brandColorAction}>{hid}<button name="delete" value={x.id} className="bb-x" aria-label="Видалити колір">×</button></form>
          </div>
        ))}</div> : <p className="mono" style={{ margin: 0 }}>Кольорів ще нема.</p>}
        <form action={brandColorAction} className="inline bb-add" style={{ flexWrap: "wrap" }}>
          {hid}
          <input type="color" name="hex" defaultValue="#3D6BFF" aria-label="Колір" className="bb-picker" />
          <input name="name" placeholder="Назва: напр. «Глибокий синій»" style={{ flex: 1, minWidth: "10rem" }} />
          <select name="role" defaultValue="" aria-label="Роль"><option value="">— роль —</option>{Object.entries(COLOR_ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <SubmitButton className="small">Додати колір</SubmitButton>
        </form>
      </section>

      <section className="card stack" style={{ gap: "0.75rem" }}>
        <div className="bb-h"><b>Шрифти</b></div>
        {fonts.length ? <div className="bb-fonts">{fonts.map((f) => (
          <div key={f.id} className="bb-font">
            <span className="bb-aa">Aa</span>
            <div className="stack" style={{ gap: "0.125rem", minWidth: 0, flex: 1 }}>
              <b>{f.name}</b>
              <span className="mono">{FONT_ROLES[f.role as keyof typeof FONT_ROLES] ?? "—"}{f.note ? ` · ${f.note}` : ""}</span>
              {f.url && <a href={f.url} target="_blank" rel="noreferrer" className="h-link">де взяти ↗</a>}
            </div>
            <form action={brandFontAction}>{hid}<button name="delete" value={f.id} className="bb-x" aria-label="Видалити шрифт">×</button></form>
          </div>
        ))}</div> : <p className="mono" style={{ margin: 0 }}>Шрифтів ще нема.</p>}
        <form action={brandFontAction} className="inline bb-add" style={{ flexWrap: "wrap" }}>
          {hid}
          <input name="name" required placeholder="Назва: напр. «Montserrat»" style={{ flex: 1, minWidth: "9rem" }} />
          <select name="role" defaultValue="headings" aria-label="Для чого">{Object.entries(FONT_ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <input name="url" placeholder="Посилання (Google Fonts)" style={{ flex: 1, minWidth: "9rem" }} />
          <SubmitButton className="small">Додати шрифт</SubmitButton>
        </form>
      </section>

      <section className="card stack" style={{ gap: "0.75rem" }}>
        <div className="bb-h"><b>Логотипи і файли</b><span className="mono">логотипи, файли шрифтів, гайдлайн PDF, фото</span></div>
        {assets.length ? <div className="bb-assets">{assets.map((a) => {
          const href = a.file_id ? `/api/files/${a.file_id}` : a.url;
          return (
            <div key={a.id} className="bb-asset">
              <a href={href} target="_blank" rel="noreferrer" className="bb-thumb">{isImg(a.mime, a.url) ? <img src={href} alt={a.title} /> : <span>{(a.title.match(/\.([a-z0-9]+)$/i)?.[1] ?? (a.mime?.split("/")[1] ?? "файл")).slice(0, 5).toUpperCase()}</span>}</a>
              <div className="stack" style={{ gap: "0.125rem", minWidth: 0 }}>
                <b className="bb-at">{a.title || "Файл"}</b>
                <span className="mono">{ASSET_KINDS[a.kind as keyof typeof ASSET_KINDS] ?? a.kind}{a.size ? ` · ${kb(a.size)}` : a.url ? " · посилання" : ""}</span>
              </div>
              <div className="inline">
                {href && <a href={href} download={a.file_id ? a.title : undefined} target="_blank" rel="noreferrer" className="btn ghost small">↓</a>}
                <form action={brandAssetAction}>{hid}<button name="delete" value={a.id} className="bb-x" aria-label="Видалити">×</button></form>
              </div>
            </div>
          );
        })}</div> : <p className="mono" style={{ margin: 0 }}>Файлів ще нема.</p>}
        <BrandUpload clientId={clientId} kinds={ASSET_KINDS} />
        <form action={brandAssetAction} className="inline bb-add" style={{ flexWrap: "wrap" }}>
          {hid}
          <select name="kind" defaultValue="guide" aria-label="Що це">{Object.entries(ASSET_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <input name="url" required placeholder="Або посилання: Диск, Figma, сайт" style={{ flex: 2, minWidth: "12rem" }} />
          <input name="title" placeholder="Назва" style={{ flex: 1, minWidth: "8rem" }} />
          <SubmitButton className="small ghost">Додати посилання</SubmitButton>
        </form>
      </section>
    </div>
  );
}
