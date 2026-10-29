"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Hit } from "@/lib/repo/search";

const KIND: Record<Hit["kind"], string> = { client: "клієнт", task: "задача", work: "історія", material: "матеріал", idea: "ідея", playbook: "плейбук" };
const PAGES: Hit[] = [
  { kind: "playbook", id: -1, title: "Центр управління", sub: "сторінка", href: "/" },
  { kind: "playbook", id: -2, title: "Задачі на сьогодні", sub: "сторінка", href: "/tasks" },
  { kind: "playbook", id: -3, title: "План на тиждень", sub: "сторінка", href: "/tasks?view=week" },
  { kind: "playbook", id: -4, title: "Воронка лідів", sub: "сторінка", href: "/pipeline" },
  { kind: "playbook", id: -5, title: "Гроші", sub: "сторінка", href: "/money" },
  { kind: "playbook", id: -6, title: "Новий клієнт", sub: "дія", href: "/clients/new" },
  { kind: "playbook", id: -7, title: "Новий плейбук", sub: "дія", href: "/playbooks/new" },
];

export default function CommandPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return; }
    const ctl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctl.signal })
        .then((r) => (r.ok ? r.json() : []))
        .then((h: Hit[]) => { setHits(h); setSel(0); })
        .catch(() => {});
    }, 150);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q]);

  const list = q.trim().length < 2 ? PAGES : [...hits, ...PAGES.filter((p) => p.title.toLowerCase().includes(q.toLowerCase()))];
  const go = (h: Hit) => { onClose(); router.push(h.href); };

  return (
    <div className="overlay top" onClick={onClose}>
      <div className="palette" onClick={(e) => e.stopPropagation()}>
        <input
          ref={input}
          id="palette-q"
          value={q}
          placeholder="Шукай клієнта, задачу, чат, плейбук…"
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, list.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
            if (e.key === "Enter" && list[sel]) go(list[sel]);
          }}
        />
        <div className="palette-list">
          {list.length ? list.map((h, i) => (
            <button key={`${h.kind}-${h.id}`} className={`palette-item ${i === sel ? "sel" : ""}`} onMouseEnter={() => setSel(i)} onClick={() => go(h)}>
              <span className="grow">
                <span className="row-title">{h.title}</span>
                <span className="row-sub">{h.sub}</span>
              </span>
              <span className="tag">{h.id < 0 ? h.sub : KIND[h.kind]}</span>
            </button>
          )) : <div className="empty">Нічого не знайшов.</div>}
        </div>
      </div>
    </div>
  );
}
