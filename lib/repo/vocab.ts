import { db } from "../db";
import { getSetting } from "./settings";

// Словник для диктування: власні назви, які треба писати точно (клієнти, проєкти, інструменти, кабінети, групи) + свій список Саші.
export function vocabulary(): string[] {
  const q = (sql: string) => { try { return (db().prepare(sql).all() as { n: string }[]).map((r) => r.n); } catch { return []; } };
  const own = (getSetting("voice.vocab") ?? "").split(/\n|,/).map((x) => x.trim()).filter(Boolean);
  const all = [
    ...own,
    ...q("SELECT name n FROM clients WHERE status != 'archived'"),
    ...q("SELECT name n FROM startups WHERE stage != 'closed'"),
    ...q("SELECT name n FROM tools"),
    ...q("SELECT name n FROM meta_accounts"),
    ...q("SELECT title n FROM tg_chats WHERE title != ''"),
  ];
  return [...new Set(all.map((x) => x.slice(0, 80)))].slice(0, 300);
}
