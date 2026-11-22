// Задача → історія клієнта (автоматично) і застосування пропозицій з черги «Підтверди».
import { ymd } from "./dates";
import { createTask, deleteTask, getTask, listTasks, setTaskStatus, taskItems } from "./repo/tasks";
import { addWork } from "./repo/worklog";
import { getClient, updateClient } from "./repo/clients";
import { addItem as addStrategyItem } from "./repo/strategy";
import { addRequest, pickProductFor } from "./repo/products";

// Закрили задачу простою галочкою → запис в історію з позначкою «авто» (дублі addWork пропускає).
// reason — коли закрили не всі пункти («закрито з N/M: …»). Викликати ДО setTaskStatus(done).
export function autoLogDone(id: number, reason = ""): void {
  const t = getTask(id);
  if (!t || t.status === "done" || !t.client_id) return;
  const items = taskItems(id), ok = items.filter((i) => i.done).length;
  const part = reason || (items.length && ok < items.length ? `закрито з ${ok}/${items.length} пунктів` : "");
  addWork({ client_id: t.client_id, task_id: id, done_at: ymd(), what: t.title, result: `авто: закрито задачу${part ? ` (${part})` : ""}` });
}

// «2026-11-16 10:21 · Іванна: «…»» → «Іванна»
export const authorOf = (evidence: string) => (evidence.match(/·\s*([^:«]{2,40}):/)?.[1] ?? "з переписки клієнта").trim();

export function applyConfirm(q: { client_id: number; kind: string; task_id: number | null; title: string; evidence: string }): void {
  if (q.kind === "task_done" && q.task_id) { autoLogDone(q.task_id, q.evidence ? `доказ: ${q.evidence}` : ""); setTaskStatus(q.task_id, "done"); }
  else if (q.kind === "task_new") {
    // Прохання клієнта по нашому продукту (CRM, сайт) — це ПРАВКА в проєкт (R-N), а не задача Саші (22.11: задачі ProVector засмічувались проханнями по CRM)
    const p = pickProductFor(q.client_id, `${q.title} ${q.evidence}`);
    if (p) addRequest(p.id, { text: `${q.title}${q.evidence ? `\n${q.evidence}` : ""}`, source: "jerry", author: authorOf(q.evidence), client_id: q.client_id });
    else createTask({ client_id: q.client_id, title: q.title, details: q.evidence ? `## Звідки\n${q.evidence}` : "", due_date: ymd() });
  }
  else if (q.kind === "log") addWork({ client_id: q.client_id, what: q.title, result: q.evidence ? `з Telegram: ${q.evidence}` : "", done_at: ymd() });
  else if (q.kind === "next_step") {
    const c = getClient(q.client_id);
    if (c?.next_step) addWork({ client_id: q.client_id, what: `Наступний крок: ${c.next_step}`, result: "авто: закрито з черги «Підтверди»", done_at: ymd() });
    updateClient(q.client_id, { next_step: "", next_step_at: null });
  } else if (q.kind === "strategy") addStrategyItem(q.client_id, { kind: "log", title: q.title, body: q.evidence, source: "jerry" });
}

// Автоісторія з розділів картки (бренд, конкуренти…): один запис на день на тему, з позначкою «авто»
export function autoLog(clientId: number, what: string, note = ""): void {
  if (!clientId || !what.trim()) return;
  addWork({ client_id: clientId, done_at: ymd(), what, result: `авто${note ? `: ${note}` : ""}` });
}

// Задачі-прохання з переписки (details «## Звідки…» або «Розібрати прохання клієнта з переписки») → правки проєктів клієнта. Повертає, скільки перенесено.
export function askTasksOf(clientId: number) {
  return listTasks("all", clientId).filter((t) => t.status !== "done" && (t.details.startsWith("## Звідки") || t.title === "Розібрати прохання клієнта з переписки"));
}
export function moveAsksToRequests(clientId: number): { moved: number; left: number } {
  let moved = 0, left = 0;
  for (const t of askTasksOf(clientId)) {
    const items = t.title === "Розібрати прохання клієнта з переписки"
      ? t.details.split("\n").filter((l) => /^- \[ \]/.test(l)).map((l) => l.replace(/^- \[ \]\s*/, ""))
      : [`${t.title}\n${t.details.replace(/^## Звідки\n?/, "").trim()}`];
    let all = true;
    for (const it of items) {
      const p = pickProductFor(clientId, it);
      if (p) { addRequest(p.id, { text: it, source: "jerry", author: authorOf(it), client_id: clientId }); moved++; } else { all = false; left++; }
    }
    if (all && items.length) deleteTask(t.id);
  }
  return { moved, left };
}
