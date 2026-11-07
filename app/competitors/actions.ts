"use server";
// Конкуренти: збереження, нагляд, архів, нотатки, перевірка Джері
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { addNote, COMP_FIELDS, deleteCompetitor, deleteNote, getCompetitor, saveCompetitor, setArchived, setWatch, type CompField } from "@/lib/repo/competitors";
import { setSetting } from "@/lib/repo/settings";

const back = (cid: number) => revalidatePath(`/clients/${cid}`);

export async function competitorSaveAction(fd: FormData) {
  await requireUser();
  const cid = Number(fd.get("client_id"));
  const id = Number(fd.get("competitor_id")) || undefined;
  const data: Partial<Record<CompField, string>> = {};
  for (const k of Object.keys(COMP_FIELDS) as CompField[]) if (fd.has(k)) data[k] = String(fd.get(k) ?? "");
  saveCompetitor(cid, data, id);
  back(cid);
}
export async function competitorFlagAction(fd: FormData) {
  await requireUser();
  const c = getCompetitor(Number(fd.get("competitor_id")));
  if (!c) return;
  const op = String(fd.get("op"));
  if (op === "watch") setWatch(c.id, !c.watch);
  else if (op === "archive") setArchived(c.id, !c.archived);
  else if (op === "delete") deleteCompetitor(c.id);
  back(c.client_id);
}
export async function competitorNoteAction(fd: FormData) {
  await requireUser();
  const c = getCompetitor(Number(fd.get("competitor_id")));
  if (!c) return;
  if (fd.get("delete")) deleteNote(Number(fd.get("delete")));
  else if (String(fd.get("text") ?? "").trim()) addNote(c.id, { kind: String(fd.get("kind") ?? "note"), text: String(fd.get("text")), url: String(fd.get("url") ?? "") });
  back(c.client_id);
}
export async function competitorCheckAction(id: number) {
  await requireUser();
  const { checkCompetitor } = await import("@/lib/competitors");
  const c = getCompetitor(id);
  const r = await checkCompetitor(id);
  if (c) back(c.client_id);
  return r;
}
export async function competitorInsightsAction(fd: FormData) {
  await requireUser();
  const cid = Number(fd.get("client_id"));
  setSetting(`comp.insights.${cid}`, String(fd.get("insights") ?? "").trim());
  back(cid);
}
