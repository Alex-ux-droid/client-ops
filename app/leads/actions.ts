"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { syncLeads } from "@/lib/metaLeads";
import { getLead, setLead, setPage } from "@/lib/repo/leads";
import { setSetting } from "@/lib/repo/settings";

export async function savePageAction(fd: FormData) {
  await requireUser();
  const id = String(fd.get("page_id") ?? "");
  const cid = Number(fd.get("client_id")) || null;
  setPage(id, { client_id: cid, leads_on: fd.get("leads_on") === "on" && cid ? 1 : 0 });
  revalidatePath("/settings");
}
export async function syncLeadsAction() {
  await requireUser();
  const r = await syncLeads({ manual: true });
  revalidatePath("/settings");
  revalidatePath("/clients");
  return r;
}
export async function leadsCopyOwnerAction(fd: FormData) {
  await requireUser();
  setSetting("leads.copy_owner", fd.get("copy") === "on" ? "on" : "off");
  revalidatePath("/settings");
}
export async function rateLeadAction(fd: FormData) {
  await requireUser();
  const l = getLead(Number(fd.get("id")));
  if (!l) return;
  const q = String(fd.get("q") ?? "");
  if (q === "good" || q === "bad" || q === "") setLead(l.id, { quality: l.quality === q ? "" : (q as "good" | "bad" | ""), quality_by: "Саша" });
  revalidatePath(`/clients/${l.client_id}`);
}
