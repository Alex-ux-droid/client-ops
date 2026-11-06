"use server";
// Промпти креативів, бренд клієнта, журнал змін реклами
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { capOn } from "@/lib/agent/caps";
import { generateCreativePrompt, type CreativeFormat } from "@/lib/creativeLab";
import { addChange, CREATIVE_STATUS, deleteChange, deletePrompt, getChange, getPrompt, updateChange, updatePrompt, type CreativeStatus } from "@/lib/repo/creatives";
import { importCreative } from "@/lib/creativeStudio";
import { setSetting } from "@/lib/repo/settings";

const back = (clientId: number, mv: string) => revalidatePath(`/clients/${clientId}`) || mv;
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function genPromptAction(clientId: number, format: CreativeFormat, angle: string, note: string) {
  await requireUser();
  if (!capOn("creatives")) return { ok: false as const, error: "Вимкнено: Можливості → «Креативи»" };
  const r = await generateCreativePrompt(clientId, { format, angle, note });
  revalidatePath(`/clients/${clientId}`);
  return r;
}
export async function promptUpdateAction(fd: FormData) {
  await requireUser();
  const p = getPrompt(Number(fd.get("prompt_id")));
  if (!p) return;
  if (fd.get("delete") === "1") { deletePrompt(p.id); back(p.client_id, "creatives"); return; }
  updatePrompt(p.id, {
    ...(fd.has("ad_ids") ? { ad_ids: fd.getAll("ad_ids").map(String).filter(Boolean).join(",") } : {}),
    ...(fd.has("verdict") ? { verdict: (["win", "lose"].includes(str(fd, "verdict")) ? str(fd, "verdict") : "") as "" } : {}),
    ...(fd.has("notes") ? { notes: str(fd, "notes") } : {}),
    ...(fd.has("prompt") ? { prompt: String(fd.get("prompt") ?? "") } : {}),
    ...(fd.has("file_url") ? { file_url: str(fd, "file_url") } : {}),
    ...(fd.has("status") && str(fd, "status") in CREATIVE_STATUS ? { status: str(fd, "status") as CreativeStatus } : {}),
  });
  back(p.client_id, "creatives");
}
export async function brandAction(fd: FormData) {
  await requireUser();
  const cid = Number(fd.get("client_id"));
  setSetting(`brand.${cid}`, String(fd.get("brand") ?? "").trim());
  back(cid, "creatives");
}
export async function creativeRulesAction(fd: FormData) {
  await requireUser();
  const cid = Number(fd.get("client_id"));
  if (fd.has("brand")) setSetting(`brand.${cid}`, String(fd.get("brand") ?? "").trim());
  if (fd.has("offer")) setSetting(`creative.offer.${cid}`, String(fd.get("offer") ?? "").trim());
  if (fd.has("rules")) setSetting(`creative.rules.${cid}`, String(fd.get("rules") ?? "").trim());
  revalidatePath(`/clients/${cid}`);
}
export async function importCreativeAction(clientId: number, text: string) {
  await requireUser();
  const r = importCreative(text, clientId);
  if (r.ok) revalidatePath(`/clients/${clientId}`);
  return r.ok ? { ok: true as const, msg: `Записав у CR-${r.id} «${r.title}» → «Зроблено»` } : r;
}
export async function changeAction(fd: FormData) {
  await requireUser();
  const cid = Number(fd.get("client_id"));
  const id = Number(fd.get("change_id")) || 0;
  if (id) {
    const c = getChange(id);
    if (!c) return;
    if (fd.get("delete") === "1") deleteChange(id);
    else updateChange(id, { result: str(fd, "result") });
    back(c.client_id, "analysis");
    return;
  }
  const what = str(fd, "what");
  if (what) addChange({ client_id: cid, what, why: str(fd, "why"), expect: str(fd, "expect"), at: str(fd, "at") || undefined });
  back(cid, "analysis");
}

// Посилання на звіт для клієнта: увімкнути / вимкнути / нове (старе перестає працювати)
export async function reportLinkAction(fd: FormData) {
  await requireUser();
  const cid = Number(fd.get("client_id"));
  const { setReportLink } = await import("@/lib/clientReport");
  const op = str(fd, "op");
  setReportLink(cid, op !== "off", op === "renew");
  revalidatePath(`/clients/${cid}`);
}

export async function saveClientMemoryAction(fd: FormData) {
  await requireUser();
  const cid = Number(fd.get("client_id"));
  const { setClientMemory } = await import("@/lib/repo/clientMemory");
  setClientMemory(cid, String(fd.get("text") ?? ""));
  revalidatePath(`/clients/${cid}`);
}
