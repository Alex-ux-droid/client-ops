"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { logout } from "@/app/login/actions";
import Chat from "./Chat";
import CommandPalette from "./CommandPalette";
import QuickAdd from "./QuickAdd";

import { SECTIONS, type Counts } from "./nav";

type Opt = { id: number; name: string };

const MOBILE = ["/", "/tasks", "/clients"];

const PAGE_NAMES: [RegExp, string][] = [
  [/^\/$/, "Центр"], [/^\/tasks/, "Задачі"], [/^\/clients\/\d+/, "картка клієнта"], [/^\/clients/, "Клієнти"],
  [/^\/journal/, "Журнал системи"], [/^\/pipeline/, "Воронка"], [/^\/money/, "Гроші"], [/^\/playbooks/, "Плейбуки"], [/^\/ideas/, "Ідеї"], [/^\/settings/, "Налаштування"],
];

export default function Shell({ counts, clients, children }: { counts: Counts; clients: Opt[]; children: React.ReactNode }) {
  const path = usePathname();
  const [search, setSearch] = useState(false);
  const [add, setAdd] = useState(false);
  const [dock, setDock] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setSearch(true); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") { e.preventDefault(); setDock((d) => !d); }
      if (e.key === "Escape") { setSearch(false); setAdd(false); setDock(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Поки відкрите вікно (помічник, пошук, додати) — сторінка ззаду не гортається
  const locked = dock || search || add;
  useEffect(() => {
    document.documentElement.classList.toggle("locked", locked);
    return () => document.documentElement.classList.remove("locked");
  }, [locked]);

  if (path === "/login") return <>{children}</>;
  const clientMatch = path.match(/^\/clients\/(\d+)/);
  const dockClient = clientMatch ? Number(clientMatch[1]) : null;
  const pageName = PAGE_NAMES.find(([re]) => re.test(path))?.[1] ?? "";
  const on = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  const all = SECTIONS.flatMap((s) => s.items);

  const links = SECTIONS.map((s) => (
    <div key={s.title} className="side-group">
      <div className="side-title">{s.title}</div>
      {s.items.map((i) => {
        const c = i.count ? counts[i.count] : 0;
        return (
          <Link key={i.href} href={i.href} className={`side-link ${on(i.href) ? "on" : ""}`}>
            <span className="ico">{i.ico}</span>
            <span className="grow">{i.label}</span>
            {c > 0 && <span className={`count ${i.bad ? "bad" : ""}`}>{c}</span>}
          </Link>
        );
      })}
    </div>
  ));

  return (
    <div className="shell">
      <aside className="side">
        <Link href="/" className="brand">Client Ops</Link>
        <button className="side-search" onClick={() => setSearch(true)}>
          <span>⌕ Пошук</span><kbd>Ctrl K</kbd>
        </button>
        <div className="side-actions">
          <button className="side-add" onClick={() => setAdd(true)}>+ Додати</button>
          <button className="side-ai ghost" onClick={() => setDock(true)} title="Помічник (Ctrl+J)">🎙 Помічник</button>
        </div>
        {links}
        <form action={logout} className="side-foot"><button className="ghost small">Вийти</button></form>
      </aside>

      <header className="topbar">
        <Link href="/" className="brand">Client Ops</Link>
        <div className="inline">
          <button className="icon-btn" onClick={() => setAdd(true)} aria-label="Додати">+</button>
          <button className="icon-btn" onClick={() => setSearch(true)} aria-label="Пошук">⌕</button>
        </div>
      </header>

      <main className="main">{children}</main>

      <nav className="tabbar">
        {MOBILE.slice(0, 2).map((h) => <TabLink key={h} item={all.find((i) => i.href === h)!} on={on(h)} counts={counts} />)}
        <button className="fab" onClick={() => setDock(true)} aria-label="Помічник">🎙</button>
        <TabLink item={all.find((i) => i.href === "/clients")!} on={on("/clients")} counts={counts} />
        <Link href="/menu" className={`tab ${path === "/menu" ? "on" : ""}`}><span className="ico">≡</span>Меню</Link>
      </nav>

      {dock && (
        <div className="overlay dock-overlay" onClick={() => setDock(false)}>
          <aside className="dock" onClick={(e) => e.stopPropagation()}>
            <div className="dock-head">
              <div>
                <h2>Помічник</h2>
                <div className="mono">{dockClient ? "про цього клієнта" : pageName ? `зараз: ${pageName}` : ""}</div>
              </div>
              <button className="icon-btn" onClick={() => setDock(false)} aria-label="Закрити">✕</button>
            </div>
            <Chat key={dockClient ?? 0} clientId={dockClient} page={pageName} compact />
          </aside>
        </div>
      )}
      {search && <CommandPalette onClose={() => setSearch(false)} />}
      {add && <QuickAdd clients={clients} onClose={() => setAdd(false)} />}
    </div>
  );
}

function TabLink({ item, on, counts }: { item: (typeof SECTIONS)[number]["items"][number]; on: boolean; counts: Counts }) {
  const c = item.count ? counts[item.count] : 0;
  return (
    <Link href={item.href} className={`tab ${on ? "on" : ""}`}>
      <span className="ico">{item.ico}{c > 0 && <i className={item.bad ? "bad" : ""} />}</span>
      {item.label}
    </Link>
  );
}
