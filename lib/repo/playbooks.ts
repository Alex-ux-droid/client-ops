import { db } from "../db";

export type Playbook = { id: number; title: string; body_md: string; tags: string; updated_at: string };
export type ClientPlaybook = { id: number; client_id: number; playbook_id: number; checked: number[]; title: string; body_md: string };

// Пункти чекліста: рядки "- [ ] текст" / "- [x] текст", по порядку
export function checklistItems(md: string): string[] {
  return md.split("\n").map((l) => l.match(/^\s*[-*]\s+\[[ xX]\]\s+(.*)$/)?.[1]).filter((x): x is string => !!x);
}

export function listPlaybooks(): (Playbook & { used: number; items: number })[] {
  const rows = db().prepare(`SELECT p.*, (SELECT COUNT(*) FROM client_playbooks cp WHERE cp.playbook_id = p.id) AS used
    FROM playbooks p ORDER BY p.title`).all() as (Playbook & { used: number })[];
  return rows.map((r) => ({ ...r, items: checklistItems(r.body_md).length }));
}

export function getPlaybook(id: number): Playbook | undefined {
  return db().prepare("SELECT * FROM playbooks WHERE id = ?").get(id) as Playbook | undefined;
}

export function savePlaybook(input: { id?: number | null; title: string; body_md: string; tags: string }): number {
  if (input.id) {
    db().prepare("UPDATE playbooks SET title = @title, body_md = @body_md, tags = @tags, updated_at = datetime('now') WHERE id = @id").run(input);
    return input.id;
  }
  return Number(db().prepare("INSERT INTO playbooks (title, body_md, tags) VALUES (@title, @body_md, @tags)").run(input).lastInsertRowid);
}

export function deletePlaybook(id: number): void {
  db().prepare("DELETE FROM playbooks WHERE id = ?").run(id);
}

export function clientPlaybooks(clientId: number): ClientPlaybook[] {
  const rows = db().prepare(`SELECT cp.id, cp.client_id, cp.playbook_id, cp.checked_json, p.title, p.body_md
    FROM client_playbooks cp JOIN playbooks p ON p.id = cp.playbook_id WHERE cp.client_id = ? ORDER BY cp.id`).all(clientId) as (Omit<ClientPlaybook, "checked"> & { checked_json: string })[];
  return rows.map(({ checked_json, ...r }) => ({ ...r, checked: JSON.parse(checked_json) as number[] }));
}

export function playbookClients(playbookId: number): { client_id: number; name: string; checked: number }[] {
  const rows = db().prepare(`SELECT cp.client_id, c.name, cp.checked_json FROM client_playbooks cp JOIN clients c ON c.id = cp.client_id WHERE cp.playbook_id = ?`).all(playbookId) as { client_id: number; name: string; checked_json: string }[];
  return rows.map((r) => ({ client_id: r.client_id, name: r.name, checked: (JSON.parse(r.checked_json) as number[]).length }));
}

export function attachPlaybook(clientId: number, playbookId: number): void {
  db().prepare("INSERT OR IGNORE INTO client_playbooks (client_id, playbook_id) VALUES (?, ?)").run(clientId, playbookId);
}

export function detachPlaybook(id: number): void {
  db().prepare("DELETE FROM client_playbooks WHERE id = ?").run(id);
}

export function toggleChecklistItem(cpId: number, index: number): void {
  const row = db().prepare("SELECT checked_json FROM client_playbooks WHERE id = ?").get(cpId) as { checked_json: string } | undefined;
  if (!row) return;
  const set = new Set(JSON.parse(row.checked_json) as number[]);
  if (set.has(index)) set.delete(index); else set.add(index);
  db().prepare("UPDATE client_playbooks SET checked_json = ? WHERE id = ?").run(JSON.stringify([...set].sort((a, b) => a - b)), cpId);
}

// Поставити або зняти галочку (без перемикання навмання)
export function setChecklistItem(cpId: number, index: number, done: boolean): void {
  const row = db().prepare("SELECT checked_json FROM client_playbooks WHERE id = ?").get(cpId) as { checked_json: string } | undefined;
  if (!row) throw new Error("Плейбук клієнта не знайдено");
  const set = new Set(JSON.parse(row.checked_json) as number[]);
  if (done) set.add(index); else set.delete(index);
  db().prepare("UPDATE client_playbooks SET checked_json = ? WHERE id = ?").run(JSON.stringify([...set].sort((a, b) => a - b)), cpId);
}
