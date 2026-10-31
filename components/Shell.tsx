"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { logout } from "@/app/login/actions";
import Chat from "./Chat";
import CommandPalette from "./CommandPalette";
import QuickAdd from "./QuickAdd";
import { SideToggle } from "./sideMini";
import TaskModal from "./TaskModal";

import type { AssistantSeed } from "./assistant";
import Bot from "./Bot";
import Drafts from "./Drafts";
import { useHoldToTalk } from "./useHoldToTalk";
import Icon from "./Icon";
import { SECTIONS, type Counts } from "./nav";

type Opt = { id: number; name: string };

const MOBILE = ["/", "/tasks", "/clients"];

const PAGE_NAMES: [RegExp, string][] = [
  [/^\/$/, "Центр"], [/^\/tasks/, "Задачі"], [/^\/clients\/\d+/, "картка клієнта"], [/^\/clients/, "Клієнти"],
  [/^\/journal/, "Журнал системи"], [/^\/pipeline/, "Воронка"], [/^\/money/, "Гроші"], [/^\/playbooks/, "Плейбуки"], [/^\/ideas/, "Ідеї"], [/^\/settings/, "Налаштування"], [/^\/lab/, "Лабораторія"], [/^\/kb/, "База знань"],
];

export default function Shell({ counts, clients, children }: { counts: Counts; clients: Opt[]; children: React.ReactNode }) {
  const path = usePathname();
  const [search, setSearch] = useState(false);
  const [add, setAdd] = useState(false);
  const [dock, setDock] = useState(false);
  const [seed, setSeed] = useState<AssistantSeed | null>(null);
  const ptt = useHoldToTalk(() => setDock(true));
  const [botState, setBotState] = useState<"idle" | "listening" | "thinking" | "speaking">("idle");
  const [mobile, setMobile] = useState(false);

  // Інші сторінки відкривають помічника подією (напр. Лабораторія: «розгорни ідею»)
  useEffect(() => {
    const onOpen = (e: Event) => {
      const d = (e as CustomEvent<{ text: string; send: boolean }>).detail ?? { text: "", send: false };
      setDock(true);
      if (d.text) setSeed({ text: d.text, send: d.send, n: Date.now() });
    };
    window.addEventListener("assistant:open", onOpen);
    const mq = window.matchMedia("(max-width: 899px)");
    const onMq = () => setMobile(mq.matches);
    onMq();
    mq.addEventListener("change", onMq);
    return () => { window.removeEventListener("assistant:open", onOpen); mq.removeEventListener("change", onMq); };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setSearch(true); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") { e.preventDefault(); setDock((d) => !d); }
      if (e.key === "Escape") { setSearch(false); setAdd(false); setDock(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Поки відкрите вікно — сторінка ззаду не гортається (помічник на компʼютері — віконце поверх, сторінкою можна користуватись)
  const locked = (dock && mobile) || search || add;
  useEffect(() => {
    document.documentElement.classList.toggle("locked", locked);
    return () => document.documentElement.classList.remove("locked");
  }, [locked]);

  if (path === "/login") return <>{children}</>;
  const clientMatch = path.match(/^\/clients\/(\d+)/);
  const dockClient = clientMatch ? Number(clientMatch[1]) : null;
  const labMatch = path.match(/^\/lab\/(\d+)/);
  const pageName = labMatch ? `Лабораторія, сесія lab_id ${labMatch[1]}` : PAGE_NAMES.find(([re]) => re.test(path))?.[1] ?? "";
  const on = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  const all = SECTIONS.flatMap((s) => s.items);

  const links = SECTIONS.map((s) => (
    <div key={s.title} className="side-group">
      <div className="side-title">{s.title}</div>
      {s.items.map((i) => {
        const c = i.count ? counts[i.count] : 0;
        return (
          <Link key={i.href} href={i.href} className={`side-link ${on(i.href) ? "on" : ""}`} title={i.label}>
            <span className="ico"><Icon name={i.ico} /></span>
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
          <span className="inline"><Icon name="search" size={16} /> <span className="lbl">Пошук</span></span><kbd>Ctrl K</kbd>
        </button>
        <div className="side-actions">
          <button className="side-add" onClick={() => setAdd(true)} title="Додати"><Icon name="plus" size={18} stroke={2.5} /> <span className="lbl">Додати</span></button>
        </div>
        {links}
        <div className="side-foot">
          <SideToggle />
          <form action={logout}><button className="ghost small side-logout">Вийти</button></form>
        </div>
      </aside>

      <header className="topbar">
        <Link href="/" className="brand">Client Ops</Link>
        <div className="inline">
          <button className="icon-btn" onClick={() => setAdd(true)} aria-label="Додати"><Icon name="plus" /></button>
          <button className="icon-btn" onClick={() => setSearch(true)} aria-label="Пошук"><Icon name="search" /></button>
        </div>
      </header>

      <main className="main">{children}</main>
      <Drafts />

      <nav className="tabbar">
        {MOBILE.slice(0, 2).map((h) => <TabLink key={h} item={all.find((i) => i.href === h)!} on={on(h)} counts={counts} />)}
        <button className="fab bot-fab ptt" {...ptt.bind} aria-label="Джері: натисни — чат, затисни — говори"><Bot size={44} state={ptt.state} /></button>
        <TabLink item={all.find((i) => i.href === "/clients")!} on={on("/clients")} counts={counts} />
        <Link href="/menu" className={`tab ${path === "/menu" ? "on" : ""}`}><span className="ico"><Icon name="menu" size={22} /></span>Меню</Link>
      </nav>

      {/* Помічник завжди на виду: робот у кутку (на телефоні — кнопка по центру знизу) */}
      {!dock && (
        <button className="bot-float-btn ptt" {...ptt.bind} aria-label="Джері: натисни — чат, затисни — говори" title="Джері: натисни — чат, затисни — говори (Ctrl+J)">
          <Bot size={76} state={ptt.state} />
          <span className="bot-label">Натисни — чат · затисни — говори</span>
        </button>
      )}
      {ptt.label && !dock && <div className={`ptt-toast ${ptt.state}`} role="status">{ptt.state === "listening" && <span className="ptt-dot" />}{ptt.label}</div>}
      {dock && (
        <div className="overlay dock-overlay" onClick={() => setDock(false)}>
          <aside className="dock" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Джері">
            <div className="dock-head">
              <Bot size={44} state={botState} />
              <div className="grow" style={{ minWidth: 0 }}>
                <h2>Джері</h2>
                <div className="mono">{dockClient ? "про цього клієнта" : pageName ? `зараз: ${pageName.replace(/, сесія lab_id \d+/, "")}` : "на зв'язку"}</div>
              </div>
              <button className="icon-btn" onClick={() => setDock(false)} aria-label="Закрити"><Icon name="close" /></button>
            </div>
            <Chat key={dockClient ?? 0} clientId={dockClient} page={pageName} compact seed={seed} onState={setBotState} />
          </aside>
        </div>
      )}
      {search && <CommandPalette onClose={() => setSearch(false)} />}
      {add && <QuickAdd clients={clients} onClose={() => setAdd(false)} />}
      <Suspense fallback={null}><TaskModal /></Suspense>
    </div>
  );
}

function TabLink({ item, on, counts }: { item: (typeof SECTIONS)[number]["items"][number]; on: boolean; counts: Counts }) {
  const c = item.count ? counts[item.count] : 0;
  return (
    <Link href={item.href} className={`tab ${on ? "on" : ""}`}>
      <span className="ico"><Icon name={item.ico} size={22} />{c > 0 && <i className={item.bad ? "bad" : ""} />}</span>
      {item.label}
    </Link>
  );
}
