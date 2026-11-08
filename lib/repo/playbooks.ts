import { db } from "../db";

export type Playbook = { id: number; title: string; body_md: string; tags: string; service: string; description: string; updated_at: string };
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

export function savePlaybook(input: { id?: number | null; title: string; body_md: string; tags: string; service?: string; description?: string }): number {
  const v = { service: "", description: "", ...input };
  if (input.id) {
    db().prepare("UPDATE playbooks SET title = @title, body_md = @body_md, tags = @tags, service = @service, description = @description, updated_at = datetime('now') WHERE id = @id").run(v);
    return input.id;
  }
  return Number(db().prepare("INSERT INTO playbooks (title, body_md, tags, service, description) VALUES (@title, @body_md, @tags, @service, @description)").run(v).lastInsertRowid);
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

// ---- Кроки плейбука (фаза 10): назва, опис, час, зсув у днях → задачі з дедлайнами
export type PlaybookStep = { id: number; playbook_id: number; position: number; title: string; description: string; minutes: number; offset_days: number };
export const playbookSteps = (playbookId: number) => db().prepare("SELECT * FROM playbook_steps WHERE playbook_id = ? ORDER BY position, id").all(playbookId) as PlaybookStep[];
export function savePlaybookStep(playbookId: number, s: { id?: number | null; title: string; description?: string; minutes?: number; offset_days?: number }): number {
  if (s.id) {
    db().prepare("UPDATE playbook_steps SET title = ?, description = ?, minutes = ?, offset_days = ? WHERE id = ? AND playbook_id = ?").run(s.title, s.description ?? "", s.minutes ?? 0, s.offset_days ?? 0, s.id, playbookId);
    return s.id;
  }
  const pos = ((db().prepare("SELECT MAX(position) m FROM playbook_steps WHERE playbook_id = ?").get(playbookId) as { m: number | null }).m ?? -1) + 1;
  return Number(db().prepare("INSERT INTO playbook_steps (playbook_id, position, title, description, minutes, offset_days) VALUES (?, ?, ?, ?, ?, ?)").run(playbookId, pos, s.title, s.description ?? "", s.minutes ?? 0, s.offset_days ?? 0).lastInsertRowid);
}
export const deletePlaybookStep = (id: number) => db().prepare("DELETE FROM playbook_steps WHERE id = ?").run(id);
export function moveStep(id: number, dir: -1 | 1): void {
  const s = db().prepare("SELECT * FROM playbook_steps WHERE id = ?").get(id) as PlaybookStep | undefined;
  if (!s) return;
  const list = playbookSteps(s.playbook_id), i = list.findIndex((x) => x.id === id), j = i + dir;
  if (j < 0 || j >= list.length) return;
  const up = db().prepare("UPDATE playbook_steps SET position = ? WHERE id = ?");
  db().transaction(() => { list.forEach((x, k) => up.run(k, x.id)); up.run(j, list[i].id); up.run(i, list[j].id); })();
}

const addDaysYmd = (ymd: string, n: number) => new Date(Date.parse(ymd + "T00:00:00Z") + n * 86400_000).toISOString().slice(0, 10);
// Застосувати: підключити до клієнта (якщо ще ні) і створити задачу на кожен крок, якого ще нема
export function applyPlaybook(clientId: number, playbookId: number, start: string): number {
  attachPlaybook(clientId, playbookId);
  const cp = db().prepare("SELECT id FROM client_playbooks WHERE client_id = ? AND playbook_id = ?").get(clientId, playbookId) as { id: number };
  db().prepare("UPDATE client_playbooks SET started_at = COALESCE(started_at, ?) WHERE id = ?").run(start, cp.id);
  const pb = getPlaybook(playbookId);
  const have = new Set((db().prepare("SELECT step_id FROM playbook_tasks WHERE client_playbook_id = ?").all(cp.id) as { step_id: number }[]).map((r) => r.step_id));
  const ins = db().prepare("INSERT INTO tasks (title, client_id, details, due_date, priority) VALUES (?, ?, ?, ?, 'normal')");
  const link = db().prepare("INSERT INTO playbook_tasks (client_playbook_id, step_id, task_id) VALUES (?, ?, ?)");
  let n = 0;
  db().transaction(() => {
    for (const s of playbookSteps(playbookId)) {
      if (have.has(s.id)) continue;
      const details = [s.description, s.minutes ? `⏱ ~${s.minutes} хв` : "", `Плейбук «${pb?.title ?? ""}», крок ${s.position + 1}.`].filter(Boolean).join("\n\n");
      const tid = Number(ins.run(s.title, clientId, details, addDaysYmd(start, s.offset_days)).lastInsertRowid);
      link.run(cp.id, s.id, tid);
      n++;
    }
  })();
  return n;
}

// На якому кроці клієнт: перший крок, задача якого не закрита
export function playbookProgress(cpId: number): { total: number; done: number; current: string | null; currentDue: string | null } {
  const rows = db().prepare(`SELECT s.title, s.position, t.status, t.due_date FROM playbook_tasks pt JOIN playbook_steps s ON s.id = pt.step_id
    LEFT JOIN tasks t ON t.id = pt.task_id WHERE pt.client_playbook_id = ? ORDER BY s.position`).all(cpId) as { title: string; position: number; status: string | null; due_date: string | null }[];
  const cur = rows.find((r) => r.status !== "done" && r.status != null);
  return { total: rows.length, done: rows.filter((r) => r.status === "done" || r.status == null).length, current: cur?.title ?? null, currentDue: cur?.due_date ?? null };
}
