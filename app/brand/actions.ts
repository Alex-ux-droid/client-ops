"use server";
// Брендбук клієнта: поля, кольори, шрифти, файли, витяжка
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { addAsset, addColor, addFont, BRAND_FIELDS, deleteAsset, deleteColor, deleteFont, getAsset, saveBrand, type BrandField } from "@/lib/repo/brand";

const back = (cid: number) => revalidatePath(`/clients/${cid}`);
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function brandFieldsAction(fd: FormData) {
  await requireUser();
  const cid = Number(fd.get("client_id"));
  const patch: Partial<Record<BrandField, string>> = {};
  for (const k of Object.keys(BRAND_FIELDS) as BrandField[]) if (fd.has(k)) patch[k] = String(fd.get(k) ?? "");
  saveBrand(cid, patch);
  back(cid);
}
export async function brandColorAction(fd: FormData) {
  await requireUser();
  const cid = Number(fd.get("client_id"));
  if (fd.get("delete")) deleteColor(Number(fd.get("delete")));
  else addColor(cid, { hex: str(fd, "hex"), name: str(fd, "name"), role: str(fd, "role") });
  back(cid);
}
export async function brandFontAction(fd: FormData) {
  await requireUser();
  const cid = Number(fd.get("client_id"));
  if (fd.get("delete")) deleteFont(Number(fd.get("delete")));
  else addFont(cid, { name: str(fd, "name"), role: str(fd, "role"), url: str(fd, "url"), note: str(fd, "note") });
  back(cid);
}
export async function brandAssetAction(fd: FormData) {
  await requireUser();
  const cid = Number(fd.get("client_id"));
  if (fd.get("delete")) { const a = getAsset(Number(fd.get("delete"))); if (a?.client_id === cid) deleteAsset(a.id); }
  else if (str(fd, "url")) addAsset(cid, { kind: str(fd, "kind"), title: str(fd, "title") || str(fd, "url"), url: str(fd, "url"), note: str(fd, "note") });
  back(cid);
}
export async function brandImportAction(clientId: number, text: string) {
  await requireUser();
  const { importBrand } = await import("@/lib/brand");
  const r = await importBrand(clientId, text);
  back(clientId);
  return r;
}
export async function brandRefreshAction(clientId: number) {
  await requireUser();
  back(clientId);
}
