// Компактна плитка-список: на екрані — іконка, назва, кількість і 2 перші пункти; клік — повний список у попапі.
import { BrandDot, brandOf } from "./Brand";
import Icon from "./Icon";
import Pop from "./Pop";

export default function ListPop({ title, items, tone, empty, ico, brands }: {
  title: string; items: string[]; tone?: "good" | "bad" | "accent"; empty?: string; ico?: string; brands?: boolean;
}) {
  if (!items.length && !empty) return null;
  const marks = brands ? [...new Map(items.map((x) => brandOf(x)).filter(Boolean).map((b) => [b!.name, b!])).values()] : [];
  return (
    <Pop className={`pop-card qt${tone ? ` qt-${tone}` : ""}`} title={`${title} · ${items.length}`} trigger={
      <>
        <span className="qt-h"><span className="qt-t">{ico && <span className="qt-ico"><Icon name={ico} /></span>}<b>{title}</b></span><span className="qt-n">{items.length}</span></span>
        {marks.length > 0 ? <span className="qt-marks">{marks.slice(0, 7).map((b) => <BrandDot key={b.name} text={b.name} size={20} />)}{marks.length > 7 && <span className="qt-more">+{marks.length - 7}</span>}</span> : null}
        {items.length ? items.slice(0, marks.length ? 1 : 2).map((x, i) => <span key={i} className="qt-l">{x}</span>) : <span className="qt-l mono">{empty}</span>}
        {items.length > 2 && <span className="qt-more">ще {items.length - (marks.length ? 1 : 2)} →</span>}
      </>
    }>
      {items.length ? <ul className={`st-list${brands ? " bd-list" : ""}`}>{items.map((x, i) => <li key={i}>{brands && <BrandDot text={x} size={16} />}{x}</li>)}</ul> : <p className="mono">{empty}</p>}
    </Pop>
  );
}
