"use server";
// Продукти і розвиток організації: збереження, записи, витяжки, промпти, секрет звʼязку
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { capOn } from "@/lib/agent/caps";
import { importProduct, newAppSecret, productPrompt, updatePrompt } from "@/lib/products";
import {
  addOrgItem, addPItem, addProduct, deleteOrgItem, deletePItem, deleteProduct, getPItem, ORG_FIELDS, P_ITEM_KINDS, saveOrg, setProductClient, updateOrgItem, updatePItem, updateProduct,
  type PItemKind, type ProductPatch,
} from "@/lib/repo/products";
import { setSetting } from "@/lib/repo/settings";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const re = (id?: number) => { revalidatePath("/products"); if (id) revalidatePath(`/products/${id}`); };

export async function saveProductAction(fd: FormData) {
  await requireUser();
  const id = Number(fd.get("product_id")) || 0;
  if (id && fd.get("delete") === "1") { deleteProduct(id); re(); redirect("/products"); }
  const p: ProductPatch = {};
  for (const k of ["name", "kind", "status", "summary", "how", "features", "stack", "links", "pros", "cons", "next_step", "kit_md"] as const) if (fd.has(k)) (p as Record<string, string>)[k] = str(fd, k);
  if (id) { updateProduct(id, p); re(id); return; }
  if (!p.name) return;
  const nid = addProduct({ ...p, name: p.name });
  re(nid);
  redirect(`/products/${nid}`);
}

export async function productItemAction(fd: FormData) {
  await requireUser();
  const pid = Number(fd.get("product_id"));
  const op = str(fd, "op") || "add";
  if (op === "add") {
    const kind = (P_ITEM_KINDS as readonly string[]).includes(str(fd, "kind")) ? (str(fd, "kind") as PItemKind) : "knowledge";
    if (str(fd, "title")) addPItem(pid, { kind, title: str(fd, "title"), body: str(fd, "body"), cat: kind === "knowledge" ? str(fd, "cat") || "lesson" : "" });
  } else {
    const it = getPItem(Number(fd.get("item_id")));
    if (it && it.product_id === pid) { if (op === "delete") deletePItem(it.id); else updatePItem(it.id, { done: it.done ? 0 : 1 }); }
  }
  re(pid);
}

export async function productClientAction(fd: FormData) {
  await requireUser();
  const pid = Number(fd.get("product_id")), cid = Number(fd.get("client_id"));
  if (pid && cid) setProductClient(pid, cid, fd.get("on") !== "0", str(fd, "note"));
  re(pid);
}

export async function productSecretAction(fd: FormData) {
  await requireUser();
  const pid = Number(fd.get("product_id"));
  if (fd.get("op") === "hide") setSetting(`app.secret_once.${pid}`, "");
  else setSetting(`app.secret_once.${pid}`, newAppSecret(pid));
  re(pid);
}

export async function productImportAction(productId: number | null, text: string): Promise<{ ok: true; id: number; summary: string[] } | { ok: false; error: string }> {
  await requireUser();
  if (!capOn("products")) return { ok: false, error: "Вимкнено: Налаштування → Можливості → «Продукти і розвиток»" };
  const r = await importProduct(text, productId);
  if (r.ok) re(r.id);
  return r;
}

export async function productPromptAction(productId: number | null, mode: "full" | "update" = "full"): Promise<string> {
  await requireUser();
  return mode === "update" && productId ? updatePrompt(productId) : productPrompt(productId);
}

// ---- Розвиток організації
export async function saveOrgAction(fd: FormData) {
  await requireUser();
  const p: Record<string, string> = {};
  for (const k of Object.keys(ORG_FIELDS)) if (fd.has(k)) p[k] = str(fd, k);
  saveOrg(p);
  revalidatePath("/kb");
}

export async function orgItemAction(fd: FormData) {
  await requireUser();
  const op = str(fd, "op") || "add";
  const id = Number(fd.get("item_id"));
  if (op === "add" && str(fd, "title")) addOrgItem({ kind: str(fd, "kind") || "plan", title: str(fd, "title"), body: str(fd, "body"), horizon: str(fd, "horizon"), product_id: Number(fd.get("product_id")) || null });
  if (op === "move" && id) updateOrgItem(id, { horizon: str(fd, "horizon") });
  if (op === "delete" && id) deleteOrgItem(id);
  revalidatePath("/kb");
}
