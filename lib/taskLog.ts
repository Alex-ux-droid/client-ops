// Задача → історія клієнта (автоматично) і застосування пропозицій з черги «Підтверди».
import { ymd } from "./dates";
import { createTask, getTask, setTaskStatus, taskItems } from "./repo/tasks";
import { addWork } from "./repo/worklog";

// Закрили задачу простою галочкою → запис в історію з позначкою «авто» (дублі addWork пропускає).
// reason — коли закрили не всі пункти («закрито з N/M: …»). Викликати ДО setTaskStatus(done).
export function autoLogDone(id: number, reason = ""): void {
  const t = getTask(id);
  if (!t || t.status === "done" || !t.client_id) return;
  const items = taskItems(id), ok = items.filter((i) => i.done).length;
  const part = reason || (items.length && ok < items.length ? `закрито з ${ok}/${items.length} пунктів` : "");
  addWork({ client_id: t.client_id, task_id: id, done_at: ymd(), what: t.title, result: `авто: закрито задачу${part ? ` (${part})` : ""}` });
}

export function applyConfirm(q: { client_id: number; kind: string; task_id: number | null; title: string; evidence: string }): void {
  if (q.kind === "task_done" && q.task_id) { autoLogDone(q.task_id, q.evidence ? `доказ: ${q.evidence}` : ""); setTaskStatus(q.task_id, "done"); }
  else if (q.kind === "task_new") createTask({ client_id: q.client_id, title: q.title, details: q.evidence ? `## Звідки\n${q.evidence}` : "", due_date: ymd() });
  else if (q.kind === "log") addWork({ client_id: q.client_id, what: q.title, result: q.evidence ? `з Telegram: ${q.evidence}` : "", done_at: ymd() });
}
