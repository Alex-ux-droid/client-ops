"use server";
// Продукти і розвиток організації: збереження, записи, витяжки, промпти, секрет звʼязку
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { capOn } from "@/lib/agent/caps";
import { fixPrompt, importProduct, newAppSecret, productPrompt, requestPrompt, updatePrompt } from "@/lib/products";
import {
  addOrgItem, addPItem, listPItems, addProduct, deleteOrgItem, deletePItem, deleteProduct, getPItem, ORG_FIELDS, P_ITEM_KINDS, saveOrg, setProductClient, updateOrgItem, updatePItem, updateProduct,
  type PItemKind, type ProductPatch,
} from "@/lib/repo/products";
import { setSetting } from "@/lib/repo/settings";
import { addRequest, createServiceProduct, deleteRequest, getRequest, REQ_STATUS, setProductOwner, setRequestStatus, type ReqStatus } from "@/lib/repo/products";
import { getClient } from "@/lib/repo/clients";
import { isServiceType, serviceDef } from "@/lib/services";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const re = (id?: number) => { revalidatePath("/products"); if (id) revalidatePath(`/products/${id}`); };

export async function saveProductAction(fd: FormData) {
  await requireUser();
  const id = Number(fd.get("product_id")) || 0;
  if (id && fd.get("delete") === "1") { deleteProduct(id); re(); redirect("/products"); }
  const p: ProductPatch = {};
  for (const k of ["name", "kind", "status", "summary", "how", "features", "stack", "links", "pros", "cons", "next_step", "kit_md", "chat_url", "repo_url", "prod_url", "clarity_id"] as const) if (fd.has(k)) (p as Record<string, string>)[k] = str(fd, k);
  if (p.clarity_id != null) p.clarity_id = (p.clarity_id.match(/projects\/view\/([a-z0-9]+)/i)?.[1] ?? p.clarity_id).replace(/[^a-z0-9]/gi, "").slice(0, 20);
  if (id) { updateProduct(id, p); re(id); revalidatePath("/clients", "layout"); return; }
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

export async function productPromptAction(productId: number | null, mode: "full" | "update" | "fix" | "requests" | "site" | "clarity" = "full"): Promise<string> {
  await requireUser();
  if (productId && mode === "clarity") { const { clarityPrompt } = await import("@/lib/sitePulse"); return clarityPrompt(productId); }
  if (productId && mode === "site") {
    const h = await headers();
    const { sitePrompt } = await import("@/lib/sitePulse");
    return sitePrompt(productId, `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host") ?? ""}`);
  }
  if (productId && mode === "requests") return requestPrompt(productId);
  if (productId && mode === "fix") return fixPrompt(productId);
  return mode === "update" && productId ? updatePrompt(productId) : productPrompt(productId);
}

// «Розібрано»: наступний промпт «виправити» бере тільки нове
export async function issuesDoneAction(fd: FormData) {
  await requireUser();
  const pid = Number(fd.get("product_id"));
  setSetting(`app.fixed_at.${pid}`, new Date().toISOString().slice(0, 19).replace("T", " "));
  for (const x of listPItems(pid, "idea")) if (x.source === "app" && !x.done) updatePItem(x.id, { done: 1 });
  re(pid);
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

// Послуга клієнта (сайт, CRM…) → паспорт розвитку як продукт; одразу можна копіювати промпт
export async function startServiceDevAction(fd: FormData) {
  await requireUser();
  const clientId = Number(fd.get("client_id")), type = str(fd, "type");
  if (!clientId || !isServiceType(type)) return;
  const c = getClient(clientId);
  if (!c) return;
  const label = serviceDef(type).label;
  const id = createServiceProduct(clientId, type, `${label} · ${c.name}`, label);
  re(id);
  revalidatePath(`/clients/${clientId}`);
}

// Чий проєкт: мій (без клієнта) або клієнта X
export async function productOwnerAction(fd: FormData) {
  await requireUser();
  const pid = Number(fd.get("product_id"));
  const cid = Number(fd.get("owner")) || null;
  if (!pid) return;
  setProductOwner(pid, cid);
  re(pid);
  if (cid) revalidatePath(`/clients/${cid}`);
}

// Правки: додати / статус / видалити
export async function requestAction(fd: FormData) {
  await requireUser();
  const pid = Number(fd.get("product_id"));
  const op = str(fd, "op") || "add";
  if (op === "add") {
    // кілька правок за раз — порожній рядок між ними
    for (const t of str(fd, "text").split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean)) addRequest(pid, { text: t, author: str(fd, "author"), source: "manual" });
    return re(pid);
  }
  const r = getRequest(Number(fd.get("id")));
  if (!r || r.product_id !== pid) return;
  if (op === "delete") deleteRequest(r.id);
  else if (op === "status" && str(fd, "status") in REQ_STATUS) setRequestStatus(r.id, str(fd, "status") as ReqStatus, fd.has("note") ? str(fd, "note") : undefined);
  re(pid);
}
