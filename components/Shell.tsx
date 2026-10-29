"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { logout } from "@/app/login/actions";
import Chat from "./Chat";
import CommandPalette from "./CommandPalette";
import QuickAdd from "./QuickAdd";

type Counts = { tasks: number; leads: number; debts: number; ideas: number; journal: number };
type Opt = { id: number; name: string };

const SECTIONS: { title: string; items: { href: string; label: string; ico: string; count?: keyof Counts; bad?: boolean }[] }[] = [
  {
    title: "Робота",
    items: [
      { href: "/", label: "Центр", ico: "◎" },
      { href: "/assistant", label: "Помічник", ico: "◉" },
      { href: "/tasks", label: "Задачі", ico: "▣", count: "tasks" },
      { href: "/clients", label: "Клієнти", ico: "◇" },
      { href: "/pipeline", label: "Воронка", ico: "⟩", count: "leads" },
      { href: "/money", label: "Гроші", ico: "◈", count: "debts", bad: true },
    ],
  },
  {
    title: "Знання",
    items: [
      { href: "/playbooks", label: "Плейбуки", ico: "☰" },
      { href: "/ideas", label: "Ідеї", ico: "✦", count: "ideas" },
      { href: "/journal", label: "Журнал системи", ico: "✎", count: "journal" },
      { href: "/settings", label: "Налаштування", ico: "⚙" },
    ],
  },
];

const MOBILE = ["/", "/tasks", "/clients"];

const PAGE_NAMES: [RegExp, string][] = [
  [/^\/$/, "Центр"], [/^\/tasks/, "Задачі"], [/^\/clients\/\d+/, "картка клієнта"], [/^\/clients/, "Клієнти"],
  [/^\/journal/, "Журнал системи"], [/^\/pipeline/, "Воронка"], [/^\/money/, "Гроші"], [/^\/playbooks/, "Плейбуки"], [/^\/ideas/, "Ідеї"], [/^\/settings/, "Налаштування"],
];

export default function Shell({ counts, clients, children }: { counts: Counts; clients: Opt[]; children: React.ReactNode }) {
  const path = usePathname();
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const [add, setAdd] = useState(false);
  const [dock, setDock] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setSearch(true); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") { e.preventDefault(); setDock((d) => !d); }
      if (e.key === "Escape") { setSearch(false); setAdd(false); setMenu(false); setDock(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => { setMenu(false); }, [path]);

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
        <button className="side-add" onClick={() => setAdd(true)}>+ Додати</button>
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
        <button className="tab" onClick={() => setMenu(true)}><span className="ico">≡</span>Меню</button>
      </nav>

      {menu && (
        <div className="overlay" onClick={() => setMenu(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            {links}
            <form action={logout}><button className="ghost small" style={{ width: "100%" }}>Вийти</button></form>
          </div>
        </div>
      )}
      {path !== "/assistant" && !dock && (
        <button className="dock-btn" onClick={() => setDock(true)} title="Помічник (Ctrl+J)">🎙 Помічник</button>
      )}
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
