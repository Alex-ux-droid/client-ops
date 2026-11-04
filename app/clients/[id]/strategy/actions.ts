"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { capOn } from "@/lib/agent/caps";
import { importExtract, partPrompt } from "@/lib/strategy";
import { createTask } from "@/lib/repo/tasks";
import { addItem, addPart, deleteItem, deletePart, getItem, getPart, HORIZONS, saveStrategy, updateItem, updatePart, type PartKind, type PartStatus, type SItemKind } from "@/lib/repo/strategy";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const re = (cid: number) => revalidatePath(`/clients/${cid}`);

export async function saveSummaryAction(fd: FormData) {
  await requireUser();
  const cid = Number(fd.get("client_id"));
  saveStrategy(cid, { ...(fd.has("where_now") ? { where_now: str(fd, "where_now") } : {}), ...(fd.has("goal") ? { goal: str(fd, "goal") } : {}), ...(fd.has("focus") ? { focus: str(fd, "focus") } : {}), ...(fd.has("insights") ? { insights: str(fd, "insights") } : {}) });
  re(cid);
}
export async function savePartAction(fd: FormData) {
  await requireUser();
  const cid = Number(fd.get("client_id"));
  const id = Number(fd.get("part_id")) || 0;
  const f = { kind: str(fd, "kind") as PartKind, status: str(fd, "status") as PartStatus, summary: str(fd, "summary"), stack: str(fd, "stack"), pros: str(fd, "pros"), cons: str(fd, "cons"), next_step: str(fd, "next_step") };
  const clean = Object.fromEntries(Object.entries(f).filter(([k]) => fd.has(k)));
  if (id) { if (fd.get("delete") === "1") deletePart(id); else updatePart(id, { ...clean, ...(fd.has("title") && str(fd, "title") ? { title: str(fd, "title") } : {}) }); }
  else if (str(fd, "title")) addPart(cid, { title: str(fd, "title"), ...clean });
  re(cid);
}
export async function addItemAction(fd: FormData) {
  await requireUser();
  const cid = Number(fd.get("client_id"));
  const title = str(fd, "title");
  if (title) addItem(cid, { kind: str(fd, "kind") as SItemKind, title, body: str(fd, "body"), part_id: Number(fd.get("part_id")) || null, horizon: str(fd, "horizon"), cat: str(fd, "cat") });
  re(cid);
}
export async function itemAction(fd: FormData) {
  await requireUser();
  const it = getItem(Number(fd.get("item_id")));
  if (!it) return;
  const op = str(fd, "op");
  if (op === "delete") deleteItem(it.id);
  else if (op === "move" && str(fd, "horizon") in HORIZONS) updateItem(it.id, { horizon: str(fd, "horizon") });
  else if (op === "task") {
    const part = it.part_id ? getPart(it.part_id) : undefined;
    const tid = createTask({ title: it.title, client_id: it.client_id, details: [part && `Частина стратегії: ${part.title}`, it.body].filter(Boolean).join("\n\n"), due_date: null });
    updateItem(it.id, { task_id: tid });
  }
  re(it.client_id);
}
export async function importAction(clientId: number, text: string) {
  await requireUser();
  if (!capOn("strategy")) return { ok: false as const, error: "Вимкнено: Можливості → «Стратегія»" };
  const r = await importExtract(clientId, text);
  re(clientId);
  return r;
}
export async function promptAction(clientId: number, partId: number | null) {
  await requireUser();
  return partPrompt(clientId, partId);
}
