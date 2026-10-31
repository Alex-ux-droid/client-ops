"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getLab } from "@/lib/repo/lab";
import {
  addItem, CANVAS, createStartup, deleteItem, deleteStartup, getItem, getStartup, STAGES, updateItem, updateStartup,
  type CanvasKey, type ItemKind, type Stage,
} from "@/lib/repo/startups";
import { createTask } from "@/lib/repo/tasks";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const int = (fd: FormData, k: string) => { const n = Number(fd.get(k)); return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null; };
const isStage = (s: string): s is Stage => STAGES.some((x) => x.k === s);
const KINDS: ItemKind[] = ["milestone", "experiment", "decision", "question", "note", "link"];
const back = (id: number, v = "", hash = "") => {
  revalidatePath(`/startups/${id}`);
  revalidatePath("/startups");
  redirect(`/startups/${id}${v ? `?v=${v}` : ""}${hash}`);
};
// Назва з тексту ідеї: перші слова першого речення
const titleOf = (text: string) => {
  const first = text.split(/[.!?\n]/)[0].trim();
  const words = first.split(/\s+/).slice(0, 7).join(" ");
  return (words.length < first.length ? `${words}…` : words) || "Нова ідея";
};

// Скринька ідей: записати як є, розгорнемо потім
export async function captureIdeaAction(fd: FormData) {
  await requireUser();
  const text = str(fd, "text");
  if (!text) return;
  createStartup({ name: titleOf(text), stage: "raw", raw_text: text });
  revalidatePath("/startups");
  redirect("/startups?saved=1");
}

// Ідея → проєкт; Джері одразу розгортає фундамент
export async function promoteIdeaAction(fd: FormData) {
  await requireUser();
  const id = int(fd, "id")!;
  updateStartup(id, { stage: "idea" });
  revalidatePath("/startups");
  redirect(`/startups/${id}?expand=1`);
}

export async function createStartupAction(fd: FormData) {
  await requireUser();
  const name = str(fd, "name");
  if (!name) return;
  const id = createStartup({ name, one_liner: str(fd, "one_liner"), stage: "idea", raw_text: str(fd, "one_liner") });
  redirect(`/startups/${id}?expand=1`);
}

// З Лабораторії: «будуємо самі» — переносимо задачу, варіанти, висновок
export async function labToStartupAction(fd: FormData) {
  await requireUser();
  const lab = getLab(int(fd, "lab_id")!);
  if (!lab) return;
  const chosen = lab.options.find((o) => o.id === lab.chosen_option_id) ?? lab.options.find((o) => /сво|вайб/i.test(o.name));
  const id = createStartup({
    name: chosen && /сво|вайб/i.test(chosen.name) ? lab.title : chosen?.name ?? lab.title,
    one_liner: chosen?.about ?? "",
    stage: "foundation",
    raw_text: lab.brief,
    lab_id: lab.id,
    client_id: lab.client_id,
    canvas: { problem: lab.brief, competitors: lab.options.filter((o) => o.id !== chosen?.id).map((o) => `${o.name}${o.about ? ` — ${o.about}` : ""}${o.price_month != null ? ` (${o.price_month}/міс)` : ""}`).join("\n") },
  });
  addItem(id, {
    kind: "decision",
    title: `Будуємо самі: ${chosen?.name ?? lab.title}`,
    body: [lab.conclusion, chosen?.pros && `Плюси: ${chosen.pros}`, chosen?.cons && `Мінуси: ${chosen.cons}`].filter(Boolean).join("\n\n"),
    data: { alternatives: lab.options.filter((o) => o.id !== chosen?.id).map((o) => o.name).join(", "), lab_id: String(lab.id) },
  });
  redirect(`/startups/${id}?expand=1`);
}

export async function saveStartupAction(fd: FormData) {
  await requireUser();
  const id = int(fd, "id")!;
  const patch: Parameters<typeof updateStartup>[1] = {};
  for (const k of ["name", "one_liner", "north_star", "next_step", "repo", "prod_url"] as const) if (fd.has(k)) patch[k] = str(fd, k);
  if (patch.repo) patch.repo = patch.repo.replace(/^https?:\/\/github\.com\//, "").replace(/\.git$/, "").replace(/\/$/, "");
  if (fd.has("client_id")) patch.client_id = int(fd, "client_id");
  const stage = str(fd, "stage");
  if (isStage(stage)) patch.stage = stage;
  updateStartup(id, patch);
  back(id, str(fd, "v"));
}

export async function saveCanvasAction(fd: FormData) {
  await requireUser();
  const id = int(fd, "id")!;
  const key = str(fd, "key") as CanvasKey;
  const block = CANVAS.find((c) => c.k === key);
  if (block) updateStartup(id, { canvas: { [key]: str(fd, "value") } });
  back(id, block?.pillar ?? "idea", `#c-${key}`);
}

export async function saveSpecAction(fd: FormData) {
  await requireUser();
  const id = int(fd, "id")!;
  updateStartup(id, { spec_md: String(fd.get("spec_md") ?? "") });
  back(id, "tech", "#spec");
}

// Калькулятор фінансів: усі поля одним махом
export async function saveFinanceAction(fd: FormData) {
  await requireUser();
  const id = int(fd, "id")!;
  const fin: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (k.startsWith("f_")) fin[k.slice(2)] = String(v);
  updateStartup(id, { finance: fin });
  back(id, "finance", "#calc");
}

export async function addItemAction(fd: FormData) {
  await requireUser();
  const id = int(fd, "id")!;
  const kind = str(fd, "kind") as ItemKind;
  if (!KINDS.includes(kind) || !getStartup(id)) return;
  const data: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (k.startsWith("d_") && String(v).trim()) data[k.slice(2)] = String(v).trim();
  const title = str(fd, "title"), body = str(fd, "body");
  if (!title && !body) back(id, str(fd, "v"));
  addItem(id, { kind, title, body, status: str(fd, "status"), data });
  back(id, str(fd, "v"));
}

export async function updateItemAction(fd: FormData) {
  await requireUser();
  const item = getItem(int(fd, "item_id")!);
  if (!item) return;
  const data: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (k.startsWith("d_")) data[k.slice(2)] = String(v).trim();
  updateItem(item.id, {
    title: fd.has("title") ? str(fd, "title") : undefined,
    body: fd.has("body") ? str(fd, "body") : undefined,
    status: fd.has("status") ? str(fd, "status") : undefined,
    data,
  });
  back(item.startup_id, str(fd, "v"), `#i-${item.id}`);
}

export async function deleteItemAction(fd: FormData) {
  await requireUser();
  const item = getItem(int(fd, "item_id")!);
  if (!item) return;
  deleteItem(item.id);
  back(item.startup_id, str(fd, "v"));
}

export async function addStartupTaskAction(fd: FormData) {
  await requireUser();
  const id = int(fd, "id")!;
  const title = str(fd, "title");
  const s = getStartup(id);
  if (!title || !s) return;
  createTask({ title, startup_id: id, milestone_id: int(fd, "milestone_id"), due_date: str(fd, "due_date") || null });
  back(id, str(fd, "v") || "plan");
}

export async function deleteStartupAction(fd: FormData) {
  await requireUser();
  deleteStartup(int(fd, "id")!);
  revalidatePath("/startups");
  redirect("/startups");
}

export async function checkNowAction(fd: FormData) {
  await requireUser();
  const id = int(fd, "id")!;
  const s = getStartup(id);
  if (!s?.prod_url) return;
  const { checkUrl } = await import("@/lib/startupMonitor");
  const { addCheck } = await import("@/lib/repo/startups");
  const r = await checkUrl(s.prod_url);
  addCheck(id, r.ok, r.status, r.ms);
  back(id, "monitor");
}
