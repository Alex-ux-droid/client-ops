import { db } from "../db";

export function getClientMemory(clientId: number): { text: string; updated_at: string } | undefined {
  return db().prepare("SELECT text, updated_at FROM client_memory WHERE client_id = ?").get(clientId) as { text: string; updated_at: string } | undefined;
}
export function setClientMemory(clientId: number, text: string): void {
  db().prepare(`INSERT INTO client_memory (client_id, text) VALUES (?, ?) ON CONFLICT(client_id) DO UPDATE SET text = excluded.text, updated_at = datetime('now')`).run(clientId, text.trim().slice(0, 8000));
}
const GENERIC = new Set(["клініка", "стоматологія", "салон", "краси", "школа", "англійської", "магазин", "компанія", "ресторан", "автосервіс", "меблі", "замовлення", "студія", "центр", "агенція", "сервіс", "group", "studio", "clinic", "school"]);

// Які клієнти згадані в тексті (за назвою або частиною назви від 5 літер) — щоб Джері сам підтягнув їхній стан
export function clientsMentioned(text: string, limit = 2): { id: number; name: string }[] {
  const low = text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ");
  const all = db().prepare("SELECT id, name FROM clients WHERE status != 'archived'").all() as { id: number; name: string }[];
  const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  const hits = all.filter((c) => {
    const n = norm(c.name);
    if (n.length >= 3 && low.includes(n)) return true;
    // «Аквавіта», «Аква Віта», «аквавіти» — порівнюємо без пробілів по основі
    const compact = n.replace(/\s/g, "");
    if (compact.length >= 5 && low.replace(/\s/g, "").includes(compact.slice(0, Math.max(5, compact.length - 2)))) return true;
    // окреме слово назви («Посмішка» з «Стоматологія «Посмішка»»), без загальних слів; основа без закінчення
    const words = n.split(" ").filter((w) => w.length >= 5 && !GENERIC.has(w));
    return words.some((w) => new RegExp(`(^|\\s)${w.slice(0, Math.max(5, w.length - 2))}`).test(low));
  });
  return hits.slice(0, limit);
}
