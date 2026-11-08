"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import Icon from "@/components/Icon";
import { SideToggle } from "@/components/sideMini";
import MeetingNote from "@/components/MeetingNote";
import type { Section } from "./sections";

// Ліва панель у клієнті: «карта» клієнта поверх загального меню (на компʼютері). На телефоні — вкладки в самій сторінці.
export default function ClientNav({ id, name, status, statusTag, sections, logo }: { id: number; name: string; status: string; statusTag: string; sections: Section[]; logo?: string }) {
  const sp = useSearchParams();
  const path = usePathname();
  const tab = path.endsWith("/edit") ? "" : sp.get("tab") ?? "overview";
  const visible = sections.filter((s) => !s.hidden || s.k === tab);
  const extra = sections.filter((s) => s.hidden && s.k !== tab);
  const groups = [...new Set(visible.map((s) => s.group))];
  return (
    <aside className="client-side" aria-label={`Клієнт ${name}`}>
      <Link href="/clients" className="client-back" title="Усі клієнти"><Icon name="back" size={18} /> <span className="lbl">Усі клієнти</span></Link>
      <Link href={`/clients/${id}`} className="client-name" title={name}>
        {logo ? <img className="client-initial client-logo" src={logo} alt="" /> : <i className="client-initial">{name.replace(/^Тест:\s*/, "").trim().slice(0, 1).toUpperCase()}</i>}
        <b>{name}</b>
        <span className={`tag ${statusTag}`}>{status}</span>
      </Link>
      <div className="client-meet"><MeetingNote clientId={id} clientName={name} label="Записати зустріч" className="btn small" /></div>
      {groups.map((g) => (
        <div key={g || "main"} className="side-group">
          {g && <div className="side-title">{g}</div>}
          {visible.filter((s) => s.group === g).map((s) => (
            <Link key={s.k} href={s.k === "overview" ? `/clients/${id}` : `/clients/${id}?tab=${s.k}`} className={`side-link ${tab === s.k ? "on" : ""}`} scroll={false} title={s.label}>
              <span className="ico"><Icon name={s.ico} /></span>
              <span className="grow">{s.label}</span>
              {s.badge ? <span className="count">{s.badge}</span> : null}
            </Link>
          ))}
        </div>
      ))}
      {extra.length > 0 && (
        <details className="side-group side-add">
          <summary className="side-link" title="Розділи без даних сховані — увімкни потрібний"><span className="ico"><Icon name="plus" /></span><span className="grow">Розділ</span></summary>
          {extra.map((s) => (
            <Link key={s.k} href={`/clients/${id}?tab=${s.k}&add=1`} className="side-link" scroll={false} title={s.label}>
              <span className="ico"><Icon name={s.ico} /></span><span className="grow">{s.label}</span>
            </Link>
          ))}
        </details>
      )}
      <div className="side-foot"><SideToggle /></div>
    </aside>
  );
}
