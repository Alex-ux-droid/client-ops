// Журнал проблем продукту: помилки і відгуки, які надсилає сам продукт (або Саша/Джері вручну)
import { db } from "../db";

export type IssueKind = "error" | "bug" | "feedback";
export type IssueStatus = "new" | "work" | "fixed" | "ignored";
export const ISSUE_KINDS: Record<IssueKind, string> = { error: "Помилка", bug: "Щось не так", feedback: "Відгук" };
export const ISSUE_STATUS: Record<IssueStatus, string> = { new: "Нове", work: "В роботі", fixed: "Виправлено", ignored: "Ігнор" };
export type StartupIssue = { id: number; startup_id: number; kind: IssueKind; title: string; details: string; url: string; reporter: string; fingerprint: string; count: number; status: IssueStatus; fix_note: string; first_at: string; last_at: string };

// Та сама проблема (той самий відбиток) — лічильник +1, а виправлена — знову «нове» (повернулась)
export function upsertIssue(i: { startup_id: number; kind: IssueKind; title: string; details: string; url: string; reporter: string; fingerprint: string }): { id: number; isNew: boolean; reopened: boolean } {
  const ex = db().prepare("SELECT id, status FROM startup_issues WHERE startup_id = ? AND fingerprint = ?").get(i.startup_id, i.fingerprint) as { id: number; status: IssueStatus } | undefined;
  if (ex) {
    const reopened = ex.status === "fixed";
    db().prepare(`UPDATE startup_issues SET count = count + 1, last_at = datetime('now'), details = CASE WHEN ? != '' THEN ? ELSE details END, url = CASE WHEN ? != '' THEN ? ELSE url END${reopened ? ", status = 'new'" : ""} WHERE id = ?`)
      .run(i.details, i.details, i.url, i.url, ex.id);
    return { id: ex.id, isNew: false, reopened };
  }
  const id = Number(db().prepare("INSERT INTO startup_issues (startup_id, kind, title, details, url, reporter, fingerprint) VALUES (@startup_id, @kind, @title, @details, @url, @reporter, @fingerprint)").run(i).lastInsertRowid);
  return { id, isNew: true, reopened: false };
}
export function listIssues(startupId: number, opts: { open?: boolean; limit?: number } = {}): StartupIssue[] {
  return db().prepare(`SELECT * FROM startup_issues WHERE startup_id = ? ${opts.open ? "AND status IN ('new','work')" : ""} ORDER BY status IN ('new','work') DESC, last_at DESC LIMIT ?`).all(startupId, opts.limit ?? 200) as StartupIssue[];
}
export const getIssue = (id: number) => db().prepare("SELECT * FROM startup_issues WHERE id = ?").get(id) as StartupIssue | undefined;
export function setIssue(id: number, patch: { status?: IssueStatus; fix_note?: string }): void {
  const keys = Object.keys(patch) as (keyof typeof patch)[];
  if (keys.length) db().prepare(`UPDATE startup_issues SET ${keys.map((k) => `${k} = @${k}`).join(", ")} WHERE id = @id`).run({ ...patch, id });
}
export const deleteIssue = (id: number) => db().prepare("DELETE FROM startup_issues WHERE id = ?").run(id);
export function openIssueCount(startupId: number): number {
  return (db().prepare("SELECT COUNT(*) n FROM startup_issues WHERE startup_id = ? AND status IN ('new','work')").get(startupId) as { n: number }).n;
}
