"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import Icon from "@/components/Icon";
import { SideToggle } from "@/components/sideMini";
import type { Section } from "./sections";

// Ліва панель у клієнті: «карта» клієнта поверх загального меню (на компʼютері). На телефоні — вкладки в самій сторінці.
export default function ClientNav({ id, name, status, statusTag, sections }: { id: number; name: string; status: string; statusTag: string; sections: Section[] }) {
  const sp = useSearchParams();
  const path = usePathname();
  const tab = path.endsWith("/edit") ? "" : sp.get("tab") ?? "overview";
  const groups = [...new Set(sections.map((s) => s.group))];
  return (
    <aside className="client-side" aria-label={`Клієнт ${name}`}>
      <Link href="/clients" className="client-back" title="Усі клієнти"><Icon name="back" size={18} /> <span className="lbl">Усі клієнти</span></Link>
      <Link href={`/clients/${id}`} className="client-name" title={name}>
        <i className="client-initial">{name.replace(/^Тест:\s*/, "").trim().slice(0, 1).toUpperCase()}</i>
        <b>{name}</b>
        <span className={`tag ${statusTag}`}>{status}</span>
      </Link>
      {groups.map((g) => (
        <div key={g || "main"} className="side-group">
          {g && <div className="side-title">{g}</div>}
          {sections.filter((s) => s.group === g).map((s) => (
            <Link key={s.k} href={s.k === "overview" ? `/clients/${id}` : `/clients/${id}?tab=${s.k}`} className={`side-link ${tab === s.k ? "on" : ""}`} scroll={false} title={s.label}>
              <span className="ico"><Icon name={s.ico} /></span>
              <span className="grow">{s.label}</span>
              {s.badge ? <span className="count">{s.badge}</span> : null}
            </Link>
          ))}
        </div>
      ))}
      <div className="side-foot"><SideToggle /></div>
    </aside>
  );
}
