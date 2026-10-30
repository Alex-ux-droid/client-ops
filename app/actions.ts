"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ymd } from "@/lib/dates";
import {
  CLIENT_FIELDS, CLIENT_STATUSES, createClient, LEAD_STAGES, setStage, setStatus, updateClient,
  type ClientInput, type ClientStatus, type LeadStage,
} from "@/lib/repo/clients";
import { addIdea, setIdeaStatus, type IdeaStatus } from "@/lib/repo/ideas";
import { addMaterial, deleteMaterial, MATERIAL_KINDS, type MaterialKind } from "@/lib/repo/materials";
import { addPayment, createMonthInvoices, deletePayment, markPaid } from "@/lib/repo/payments";
import {
  attachPlaybook, checklistItems, clientPlaybooks, deletePlaybook, detachPlaybook, getPlaybook, savePlaybook, toggleChecklistItem,
} from "@/lib/repo/playbooks";
import { createTask, createTasksBulk, deleteTask, getTask, setTaskStatus, type TaskStatus } from "@/lib/repo/tasks";
import { addWork, deleteWork } from "@/lib/repo/worklog";
import { addTool, deleteFolder, deleteTool, enableService, findToolByName, removeService, saveFolder, updateService } from "@/lib/repo/services";
import { createClientFolders, googleConnected, readMail, sendMail } from "@/lib/google";
import { logError } from "@/lib/log";
import { addDevEntry, deleteDev } from "@/lib/repo/devlog";
import { getClient } from "@/lib/repo/clients";
import { FOLDER_KINDS, isServiceType, serviceDef, TOOL_CATEGORY_LABEL, type ToolCategory } from "@/lib/services";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
// Посилання: «site.com» → «https://site.com»; браузерну перевірку не вмикаємо, вона мовчки блокує «Зберегти»
const link = (fd: FormData, k: string) => {
  const v = str(fd, k);
  return !v || /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v.replace(/^\/+/, "")}`;
};
const num = (fd: FormData, k: string) => {
  const n = Number(fd.get(k));
  return Number.isFinite(n) && n > 0 ? n : null;
};
const amount = (fd: FormData, k: string) => {
  const n = Number(String(fd.get(k) ?? "").replace(",", ".").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};
const done = (to?: string) => {
  revalidatePath("/", "layout");
  if (to) redirect(to);
};

// ---- Клієнти
export async function saveClient(fd: FormData) {
  await requireUser();
  // Тільки поля, які є у формі — щоб не затерти те, чого форма не показує
  const raw = Object.fromEntries(CLIENT_FIELDS.filter((f) => fd.has(f)).map((f) => [f, str(fd, f)])) as Record<string, string>;
  const input: Record<string, unknown> = { ...raw };
  if ("status" in raw) input.status = CLIENT_STATUSES.includes(raw.status as ClientStatus) ? raw.status : "active";
  if ("stage" in raw) input.stage = LEAD_STAGES.includes(raw.stage as LeadStage) ? raw.stage : "new";
  if ("fee_monthly" in raw) input.fee_monthly = amount(fd, "fee_monthly");
  if ("pay_day" in raw) input.pay_day = Math.min(Math.max(Math.round(amount(fd, "pay_day")) || 1, 1), 31);
  if ("locations" in raw) input.locations = Math.max(Math.round(amount(fd, "locations")) || 1, 1);
  if ("work_since" in raw) input.work_since = /^\d{4}-\d{2}-\d{2}$/.test(raw.work_since) ? raw.work_since : null;
  if (!input.name) throw new Error("Потрібна назва клієнта");
  const id = num(fd, "id");
  if (!id) throw new Error("Нового клієнта створюй через «Новий клієнт»");
  updateClient(id, input as Partial<ClientInput>);
  done(`/clients/${id}`);
}

// Новий клієнт: мінімум полів, далі — повна картка
export async function createClientQuick(fd: FormData) {
  await requireUser();
  const name = str(fd, "name");
  if (!name) throw new Error("Потрібна назва");
  const status = str(fd, "status") === "active" ? "active" : "lead";
  const base = Object.fromEntries(CLIENT_FIELDS.map((f) => [f, ""])) as unknown as ClientInput;
  const id = createClient({
    ...base, name, owner_name: str(fd, "owner_name"), niche: str(fd, "niche"), phone: str(fd, "phone"),
    status, stage: "new", fee_monthly: 0, pay_day: 1, locations: Math.max(Math.round(amount(fd, "locations")) || 1, 1),
    work_since: status === "active" ? (str(fd, "work_since") || ymd()) : null,
  } as ClientInput);
  if (googleConnected()) await makeDriveFolders(id, name).catch((e) => logError("drive-folders", e));
  done(`/clients/${id}?new=1`);
}

// ---- Послуги клієнта
export async function enableServiceAction(fd: FormData) {
  await requireUser();
  const id = num(fd, "client_id");
  const type = str(fd, "type");
  if (!id || !isServiceType(type)) return;
  enableService(id, type, ymd());
  done(`/clients/${id}?tab=${type}`);
}

export async function saveServiceAction(fd: FormData) {
  await requireUser();
  const id = num(fd, "client_id");
  const type = str(fd, "type");
  if (!id || !isServiceType(type)) return;
  const def = serviceDef(type);
  const details = Object.fromEntries(def.fields.map((f) => [f.key, f.type === "url" ? link(fd, `d_${f.key}`) : str(fd, `d_${f.key}`)]));
  let toolId = num(fd, "tool_id");
  const newTool = str(fd, "new_tool");
  if (def.tool && newTool) toolId = findToolByName(def.tool.category, newTool)?.id ?? addTool(def.tool.category, newTool);
  const st = str(fd, "status");
  updateService(id, type, {
    status: st === "paused" || st === "done" ? st : "active",
    started_at: str(fd, "started_at") || null,
    tool_id: def.tool ? toolId : null,
    details,
    notes: str(fd, "notes"),
  });
  done(`/clients/${id}?tab=${type}&saved=1`);
}

export async function removeServiceAction(fd: FormData) {
  await requireUser();
  const id = num(fd, "client_id");
  const type = str(fd, "type");
  if (id && isServiceType(type)) removeService(id, type);
  done(id ? `/clients/${id}` : undefined);
}

// ---- Папки клієнта
export async function saveFoldersAction(fd: FormData) {
  await requireUser();
  const id = num(fd, "client_id");
  if (!id) return;
  updateClient(id, { drive_url: link(fd, "drive_url") });
  for (const f of FOLDER_KINDS) {
    const url = link(fd, `f_${f.kind}`);
    if (url) saveFolder(id, f.kind, f.title, url);
    else deleteFolder(id, f.kind);
  }
  done();
}

// ---- Google Диск: папка клієнта і підпапки
async function makeDriveFolders(clientId: number, name: string) {
  const { mainUrl, subs } = await createClientFolders(name, FOLDER_KINDS);
  updateClient(clientId, { drive_url: mainUrl });
  for (const f of subs) saveFolder(clientId, f.kind, f.title, f.url);
}

export async function createDriveFoldersAction(fd: FormData) {
  await requireUser();
  const id = num(fd, "client_id");
  const c = id ? getClient(id) : undefined;
  if (!c) return;
  try {
    await makeDriveFolders(c.id, c.name);
  } catch (e) {
    logError("drive-folders", e);
    redirect(`/clients/${c.id}?tab=files&err=${encodeURIComponent(e instanceof Error ? e.message : "Помилка Google")}`);
  }
  done(`/clients/${c.id}?tab=files`);
}

// ---- Gmail
export async function sendMailAction(fd: FormData) {
  await requireUser();
  const id = num(fd, "client_id");
  const to = str(fd, "to");
  const body = String(fd.get("body") ?? "").trim();
  const back = `/clients/${id}?tab=mail`;
  if (!to || !body) redirect(`${back}&err=${encodeURIComponent("Вкажи адресу і текст")}`);
  try {
    await sendMail({ to, subject: str(fd, "subject") || "(без теми)", body, threadId: str(fd, "thread_id") || undefined, inReplyTo: str(fd, "in_reply_to") || undefined });
    if (id) addWork({ client_id: id, what: `Лист клієнту: ${str(fd, "subject") || "(без теми)"}`, done_at: ymd() });
  } catch (e) {
    logError("gmail-send", e);
    redirect(`${back}&err=${encodeURIComponent(e instanceof Error ? e.message : "Не вдалось надіслати")}`);
  }
  done(`${back}&sent=1`);
}

export async function saveMailToMaterials(fd: FormData) {
  await requireUser();
  const id = num(fd, "client_id");
  const mid = str(fd, "message_id");
  if (!id || !mid) return;
  const m = await readMail(mid);
  addMaterial({ client_id: id, kind: "chat", title: `Лист: ${m.subject}`, content: `Від: ${m.from}\nКому: ${m.to}\nДата: ${m.date.slice(0, 10)}\n\n${m.body}` });
  done(`/clients/${id}?tab=materials`);
}

// ---- Журнал системи
export async function addDevAction(fd: FormData) {
  await requireUser();
  const title = str(fd, "title");
  const kind = str(fd, "kind");
  if (!title || !["request", "bug", "note"].includes(kind)) return;
  addDevEntry({ kind: kind as "request" | "bug" | "note", source: "sasha", title, body: String(fd.get("body") ?? "").trim() });
  done();
}

export async function deleteDevAction(fd: FormData) {
  await requireUser();
  const id = num(fd, "id");
  if (id) deleteDev(id);
  done();
}

// ---- Довідники
export async function addToolAction(fd: FormData) {
  await requireUser();
  const category = str(fd, "category");
  const name = str(fd, "name");
  if (name && category in TOOL_CATEGORY_LABEL) addTool(category as ToolCategory, name, str(fd, "url"));
  done();
}

export async function deleteToolAction(fd: FormData) {
  await requireUser();
  const id = num(fd, "id");
  if (id) deleteTool(id);
  done();
}

// Рух по воронці: stage для лідів, won -> active, lost -> archived
export async function moveLead(fd: FormData) {
  await requireUser();
  const id = num(fd, "id");
  const to = str(fd, "to");
  if (!id) return;
  if (to === "won") setStatus(id, "active");
  else if (to === "lost") setStatus(id, "archived");
  else if (LEAD_STAGES.includes(to as LeadStage)) setStage(id, to as LeadStage);
  done();
}

export async function saveNextStep(fd: FormData) {
  await requireUser();
  const id = num(fd, "id");
  if (id) updateClient(id, { next_step: str(fd, "next_step") });
  done();
}

// ---- Задачі
export async function addTask(fd: FormData) {
  await requireUser();
  const title = str(fd, "title");
  if (!title) return;
  createTask({ title, client_id: num(fd, "client_id"), due_date: str(fd, "due_date") || null, details: str(fd, "details") });
  done();
}

export async function setTask(fd: FormData) {
  await requireUser();
  const id = num(fd, "id");
  const status = str(fd, "status") as TaskStatus;
  if (id && ["todo", "doing", "done"].includes(status)) setTaskStatus(id, status);
  done();
}

// Закрити задачу + записати що зробили (в історію клієнта)
export async function closeTaskWithLog(fd: FormData) {
  await requireUser();
  const id = num(fd, "id");
  const task = id ? getTask(id) : undefined;
  if (!task) return;
  setTaskStatus(task.id, "done");
  if (task.client_id) {
    addWork({ client_id: task.client_id, task_id: task.id, done_at: ymd(), what: str(fd, "what") || task.title, why: str(fd, "why"), result: str(fd, "result") });
  }
  done();
}

export async function removeTask(fd: FormData) {
  await requireUser();
  const id = num(fd, "id");
  if (id) deleteTask(id);
  done();
}

// ---- Історія робіт
export async function logWork(fd: FormData) {
  await requireUser();
  const client_id = num(fd, "client_id");
  const what = str(fd, "what");
  if (!client_id || !what) return;
  addWork({ client_id, what, why: str(fd, "why"), result: str(fd, "result"), done_at: str(fd, "done_at") || ymd() });
  done();
}

export async function removeWork(fd: FormData) {
  await requireUser();
  const id = num(fd, "id");
  if (id) deleteWork(id);
  done();
}

// ---- Ідеї
export async function saveIdea(fd: FormData) {
  await requireUser();
  const text = str(fd, "text");
  if (text) addIdea(text, num(fd, "client_id"));
  done();
}

export async function markIdea(fd: FormData) {
  await requireUser();
  const id = num(fd, "id");
  const status = str(fd, "status") as IdeaStatus;
  if (id && ["new", "used", "dropped"].includes(status)) setIdeaStatus(id, status);
  done();
}

// Ідея -> задача
export async function ideaToTask(fd: FormData) {
  await requireUser();
  const id = num(fd, "id");
  const text = str(fd, "text");
  if (!id || !text) return;
  createTask({ title: text.slice(0, 200), client_id: num(fd, "client_id"), due_date: ymd() });
  setIdeaStatus(id, "used");
  done();
}

// ---- Матеріали
export async function saveMaterial(fd: FormData) {
  await requireUser();
  const client_id = num(fd, "client_id");
  const content = str(fd, "content");
  if (!client_id || !content) return;
  const kind = (MATERIAL_KINDS.includes(str(fd, "kind") as MaterialKind) ? str(fd, "kind") : "other") as MaterialKind;
  addMaterial({ client_id, kind, title: str(fd, "title") || content.slice(0, 60), content });
  done();
}

export async function removeMaterial(fd: FormData) {
  await requireUser();
  const id = num(fd, "id");
  if (id) deleteMaterial(id);
  done();
}

// ---- Гроші
export async function savePayment(fd: FormData) {
  await requireUser();
  const client_id = num(fd, "client_id");
  const sum = amount(fd, "amount");
  if (!client_id || sum <= 0) return;
  const paid = str(fd, "paid") === "1";
  const date = str(fd, "due_date") || ymd();
  addPayment({ client_id, amount: sum, due_date: date, paid_at: paid ? date : null, note: str(fd, "note") });
  done();
}

export async function togglePaid(fd: FormData) {
  await requireUser();
  const id = num(fd, "id");
  if (id) markPaid(id, str(fd, "paid") === "1");
  done();
}

export async function removePayment(fd: FormData) {
  await requireUser();
  const id = num(fd, "id");
  if (id) deletePayment(id);
  done();
}

export async function makeMonthInvoices(fd: FormData) {
  await requireUser();
  const month = str(fd, "month");
  if (/^\d{4}-\d{2}$/.test(month)) createMonthInvoices(month);
  done();
}

// ---- Плейбуки
export async function savePlaybookAction(fd: FormData) {
  await requireUser();
  const title = str(fd, "title");
  if (!title) return;
  const id = savePlaybook({ id: num(fd, "id"), title, body_md: String(fd.get("body_md") ?? ""), tags: str(fd, "tags") });
  done(`/playbooks/${id}`);
}

export async function removePlaybook(fd: FormData) {
  await requireUser();
  const id = num(fd, "id");
  if (id) deletePlaybook(id);
  done("/playbooks");
}

export async function attachPlaybookAction(fd: FormData) {
  await requireUser();
  const client_id = num(fd, "client_id");
  const playbook_id = num(fd, "playbook_id");
  if (client_id && playbook_id) attachPlaybook(client_id, playbook_id);
  done();
}

export async function detachPlaybookAction(fd: FormData) {
  await requireUser();
  const id = num(fd, "id");
  if (id) detachPlaybook(id);
  done();
}

export async function toggleItem(fd: FormData) {
  await requireUser();
  const id = num(fd, "id");
  const index = Number(fd.get("index"));
  if (id && Number.isInteger(index) && index >= 0) toggleChecklistItem(id, index);
  done();
}

// Невиконані пункти плейбука -> задачі клієнта
export async function playbookToTasks(fd: FormData) {
  await requireUser();
  const cpId = num(fd, "id");
  const client_id = num(fd, "client_id");
  if (!cpId || !client_id) return;
  const cp = clientPlaybooks(client_id).find((x) => x.id === cpId);
  const pb = cp && getPlaybook(cp.playbook_id);
  if (!cp || !pb) return;
  const open = checklistItems(pb.body_md).filter((_, i) => !cp.checked.includes(i));
  createTasksBulk(open.map((t) => `${t} · ${pb.title}`), client_id, str(fd, "due_date") || null);
  done();
}

// ---- Meta Ads: «Оновити зараз» з панелі «Реклама»
export async function syncMetaNowAction() {
  await requireUser();
  const { syncAll } = await import("@/lib/meta");
  const r = await syncAll();
  revalidatePath("/ads");
  redirect(`/ads?synced=${r.failed ? `err&n=${r.failed}` : "ok"}`);
}

// ---- Meta Ads: розбір від Джері (цифри + картинки креативів)
export async function analyzeMetaAction(fd: FormData) {
  await requireUser();
  const id = num(fd, "client_id");
  if (!id) return;
  let err = "";
  try {
    const { analyzeMeta } = await import("@/lib/metaAnalysis");
    await analyzeMeta(id);
  } catch (e) {
    logError("meta-analysis", e);
    err = e instanceof Error ? e.message : "Не вдалось";
  }
  redirect(`/clients/${id}?tab=meta_ads&mv=analysis${err ? `&err=${encodeURIComponent(err)}` : ""}`);
}
