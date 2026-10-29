"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { finishLab } from "@/lib/lab";
import {
  addCriterion, addOption, createLab, deleteCriterion, deleteLab, deleteOption, getLab, isLabCategory, setCriterionWeight,
  setLabStatus, setScore, updateLab, updateOption,
} from "@/lib/repo/lab";
import { listTools } from "@/lib/repo/services";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const int = (fd: FormData, k: string) => { const n = Number(fd.get(k)); return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null; };
const price = (fd: FormData, k: string) => {
  const v = str(fd, k).replace(/\s/g, "").replace(",", ".");
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};
const back = (id: number, hash = "") => { revalidatePath(`/lab/${id}`); redirect(`/lab/${id}${hash}`); };

export async function createLabAction(fd: FormData) {
  await requireUser();
  const cat = str(fd, "category");
  const id = createLab({
    client_id: int(fd, "client_id"),
    title: str(fd, "title") || "Підбір рішення",
    category: isLabCategory(cat) ? cat : "other",
    brief: str(fd, "brief"),
  });
  redirect(`/lab/${id}`);
}

export async function saveLabTextAction(fd: FormData) {
  await requireUser();
  const id = int(fd, "id")!;
  updateLab(id, {
    ...(fd.has("title") ? { title: str(fd, "title") || "Підбір рішення" } : {}),
    ...(fd.has("client_id") ? { client_id: int(fd, "client_id") } : {}),
    ...(fd.has("brief") ? { brief: str(fd, "brief") } : {}),
    ...(fd.has("notes") ? { notes: str(fd, "notes") } : {}),
  });
  back(id);
}

export async function addCriterionAction(fd: FormData) {
  await requireUser();
  const id = int(fd, "id")!;
  const name = str(fd, "name");
  if (name) addCriterion(id, name, int(fd, "weight") ?? 2);
  back(id, "#matrix");
}

export async function deleteCriterionAction(fd: FormData) {
  await requireUser();
  deleteCriterion(int(fd, "criterion_id")!);
  back(int(fd, "id")!, "#matrix");
}

export async function addOptionAction(fd: FormData) {
  await requireUser();
  const id = int(fd, "id")!;
  const l = getLab(id);
  const toolId = int(fd, "tool_id");
  const tool = toolId ? listTools().find((t) => t.id === toolId) : undefined;
  const name = str(fd, "name") || tool?.name;
  if (l && name) addOption(id, { name, tool_id: tool?.id ?? null, link: tool?.url ?? "" });
  back(id, "#options");
}

export async function saveOptionAction(fd: FormData) {
  await requireUser();
  const optionId = int(fd, "option_id")!;
  updateOption(optionId, {
    name: str(fd, "name") || "Варіант",
    link: str(fd, "link"),
    price_month: price(fd, "price_month"),
    price_setup: price(fd, "price_setup"),
    pros: str(fd, "pros"),
    cons: str(fd, "cons"),
    notes: str(fd, "notes"),
  });
  back(int(fd, "id")!, `#opt-${optionId}`);
}

export async function deleteOptionAction(fd: FormData) {
  await requireUser();
  deleteOption(int(fd, "option_id")!);
  back(int(fd, "id")!, "#options");
}

// Матриця: оцінки s_<option>_<criterion> і ваги w_<criterion>
export async function saveMatrixAction(fd: FormData) {
  await requireUser();
  const id = int(fd, "id")!;
  for (const [k, v] of fd.entries()) {
    const m = k.match(/^s_(\d+)_(\d+)$/);
    if (m) setScore(Number(m[1]), Number(m[2]), Number(v) || null);
    const w = k.match(/^w_(\d+)$/);
    if (w) setCriterionWeight(Number(w[1]), Number(v));
  }
  back(id, "#matrix");
}

export async function finishLabAction(fd: FormData) {
  await requireUser();
  const id = int(fd, "id")!;
  const { clientId } = finishLab(id, {
    chosenOptionId: int(fd, "chosen_option_id"),
    conclusion: str(fd, "conclusion"),
    enableService: fd.get("enable_service") === "on",
  });
  revalidatePath("/", "layout");
  redirect(clientId ? `/clients/${clientId}?tab=materials` : `/lab/${id}`);
}

export async function reopenLabAction(fd: FormData) {
  await requireUser();
  const id = int(fd, "id")!;
  setLabStatus(id, "open");
  back(id);
}

export async function deleteLabAction(fd: FormData) {
  await requireUser();
  deleteLab(int(fd, "id")!);
  revalidatePath("/lab");
  redirect("/lab");
}
