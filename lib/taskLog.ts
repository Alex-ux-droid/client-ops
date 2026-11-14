// Задача → історія клієнта (автоматично) і застосування пропозицій з черги «Підтверди».
import { ymd } from "./dates";
import { createTask, getTask, setTaskStatus, taskItems } from "./repo/tasks";
import { addWork } from "./repo/worklog";
import { getClient, updateClient } from "./repo/clients";
import { addItem as addStrategyItem } from "./repo/strategy";
import { addRequest, clientProducts, reqCode } from "./repo/products";

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
  else if (q.kind === "task_new") {
    // Прохання клієнта, в якого рівно один наш продукт (напр. Аква Віта → Oselya CRM), — ще й правкою в продукт (аудит 14.11)
    const ps = clientProducts(q.client_id);
    let req = "";
    if (ps.length === 1) req = reqCode(addRequest(ps[0].id, { text: `${q.title}${q.evidence ? `\n${q.evidence}` : ""}`, source: "jerry", author: "з переписки клієнта", client_id: q.client_id }));
    createTask({ client_id: q.client_id, title: q.title, details: [q.evidence && `## Звідки\n${q.evidence}`, req && `Правка ${req} у проєкті «${ps[0].name}» — закриється з витяжкою оновлення.`].filter(Boolean).join("\n\n"), due_date: ymd() });
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
