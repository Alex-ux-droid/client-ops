"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { capOn } from "@/lib/agent/caps";
import { getDiag, runDiagnosis } from "@/lib/metaDiagnose";
import { addPathItem, listPath } from "@/lib/repo/strategyPath";

export async function diagnoseAction(clientId: number): Promise<{ ok: boolean; error?: string }> {
  await requireUser();
  if (!capOn("ads_diag")) return { ok: false, error: "Вимкнено: Налаштування → Можливості → «Діагностика реклами»" };
  const r = await runDiagnosis(clientId);
  revalidatePath(`/clients/${clientId}`);
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

// Дія з діагностики → пункт «Шляху» стратегії (без дублів за назвою)
export async function diagToPathAction(fd: FormData) {
  await requireUser();
  const cid = Number(fd.get("client_id")), i = Number(fd.get("i"));
  const d = getDiag(cid), a = d?.actions[i];
  if (!a) return;
  if (!listPath(cid).some((x) => x.title.toLowerCase() === a.title.toLowerCase())) addPathItem(cid, { stage: a.stage ?? "red", title: a.title, body: [a.why && `Чому: ${a.why}`, a.how && `Як: ${a.how}`, `З діагностики реклами ${d!.at.slice(0, 10)}`].filter(Boolean).join("\n") });
  revalidatePath(`/clients/${cid}`);
}
