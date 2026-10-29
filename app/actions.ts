"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ymd } from "@/lib/dates";
import { CLIENT_FIELDS, CLIENT_STATUSES, createClient, updateClient, type ClientInput, type ClientStatus } from "@/lib/repo/clients";
import { addIdea, setIdeaStatus, type IdeaStatus } from "@/lib/repo/ideas";
import { addMaterial, deleteMaterial, MATERIAL_KINDS, type MaterialKind } from "@/lib/repo/materials";
import { createTask, deleteTask, getTask, setTaskStatus, type TaskStatus } from "@/lib/repo/tasks";
import { addWork, deleteWork } from "@/lib/repo/worklog";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const num = (fd: FormData, k: string) => {
  const n = Number(fd.get(k));
  return Number.isFinite(n) && n > 0 ? n : null;
};
const back = (fd: FormData, fallback = "/") => str(fd, "back") || fallback;

// ---- Клієнти
function clientFromForm(fd: FormData): ClientInput {
  const input = Object.fromEntries(CLIENT_FIELDS.map((f) => [f, str(fd, f)])) as ClientInput;
  if (!CLIENT_STATUSES.includes(input.status as ClientStatus)) input.status = "active";
  return input;
}

export async function saveClient(fd: FormData) {
  await requireUser();
  const input = clientFromForm(fd);
  if (!input.name) throw new Error("Потрібна назва клієнта");
  const id = num(fd, "id");
  const clientId = id ?? createClient(input);
  if (id) updateClient(id, input);
  revalidatePath("/", "layout");
  redirect(`/clients/${clientId}`);
}

// ---- Задачі
export async function addTask(fd: FormData) {
  await requireUser();
  const title = str(fd, "title");
  if (!title) return;
  createTask({ title, client_id: num(fd, "client_id"), due_date: str(fd, "due_date") || null, details: str(fd, "details") });
  revalidatePath("/", "layout");
}

export async function setTask(fd: FormData) {
  await requireUser();
  const id = num(fd, "id");
  const status = str(fd, "status") as TaskStatus;
  if (id && ["todo", "doing", "done"].includes(status)) setTaskStatus(id, status);
  revalidatePath("/", "layout");
}

// Закрити задачу + записати що зробили (в історію клієнта)
export async function closeTaskWithLog(fd: FormData) {
  await requireUser();
  const id = num(fd, "id");
  const task = id ? getTask(id) : undefined;
  if (!task) return;
  setTaskStatus(task.id, "done");
  const what = str(fd, "what") || task.title;
  if (task.client_id) {
    addWork({ client_id: task.client_id, task_id: task.id, done_at: ymd(), what, why: str(fd, "why"), result: str(fd, "result") });
  }
  revalidatePath("/", "layout");
}

export async function removeTask(fd: FormData) {
  await requireUser();
  const id = num(fd, "id");
  if (id) deleteTask(id);
  revalidatePath("/", "layout");
}

// ---- Історія робіт
export async function logWork(fd: FormData) {
  await requireUser();
  const client_id = num(fd, "client_id");
  const what = str(fd, "what");
  if (!client_id || !what) return;
  addWork({ client_id, what, why: str(fd, "why"), result: str(fd, "result"), done_at: str(fd, "done_at") || ymd() });
  revalidatePath("/", "layout");
}

export async function removeWork(fd: FormData) {
  await requireUser();
  const id = num(fd, "id");
  if (id) deleteWork(id);
  revalidatePath("/", "layout");
}

// ---- Ідеї
export async function saveIdea(fd: FormData) {
  await requireUser();
  const text = str(fd, "text");
  if (text) addIdea(text, num(fd, "client_id"));
  revalidatePath("/", "layout");
}

export async function markIdea(fd: FormData) {
  await requireUser();
  const id = num(fd, "id");
  const status = str(fd, "status") as IdeaStatus;
  if (id && ["new", "used", "dropped"].includes(status)) setIdeaStatus(id, status);
  revalidatePath("/", "layout");
}

// ---- Матеріали (чати, дані з реклами, брифи)
export async function saveMaterial(fd: FormData) {
  await requireUser();
  const client_id = num(fd, "client_id");
  const content = str(fd, "content");
  if (!client_id || !content) return;
  const kind = (MATERIAL_KINDS.includes(str(fd, "kind") as MaterialKind) ? str(fd, "kind") : "other") as MaterialKind;
  addMaterial({ client_id, kind, title: str(fd, "title") || content.slice(0, 60), content });
  revalidatePath("/", "layout");
}

export async function removeMaterial(fd: FormData) {
  await requireUser();
  const id = num(fd, "id");
  if (id) deleteMaterial(id);
  revalidatePath("/", "layout");
  redirect(back(fd));
}
