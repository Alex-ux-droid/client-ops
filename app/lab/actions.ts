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
  const brief = str(fd, "brief");
  // Назва — з першого речення проблеми; категорію і критерії потім уточнює помічник
  const first = brief.split(/[.!?\n]/)[0].trim();
  const id = createLab({
    client_id: int(fd, "client_id"),
    title: str(fd, "title") || (first.length > 80 ? `${first.slice(0, 77)}…` : first) || "Підбір рішення",
    category: isLabCategory(cat) ? cat : "other",
    brief,
  });
  redirect(`/lab/${id}?start=1`);
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
    about: str(fd, "about"),
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

// ---- Сценарії і пропозиція клієнту
const scFields = (fd: FormData) => ({
  title: str(fd, "title"), summary: str(fd, "summary"), steps_md: String(fd.get("steps_md") ?? ""), timeline: str(fd, "timeline"),
  price_setup: price(fd, "price_setup"), price_month: price(fd, "price_month"), pros: str(fd, "pros"), cons: str(fd, "cons"),
});
export async function addScenarioAction(fd: FormData) {
  await requireUser();
  const id = int(fd, "id")!;
  const f = scFields(fd);
  if (!f.title) return;
  const { addScenario } = await import("@/lib/repo/lab");
  const sid = addScenario(id, f);
  revalidatePath(`/lab/${id}`); redirect(`/lab/${id}?sc=${sid}#scenarios`);
}
export async function saveScenarioAction(fd: FormData) {
  await requireUser();
  const id = int(fd, "id")!, sid = int(fd, "scenario_id")!;
  const { updateScenario } = await import("@/lib/repo/lab");
  updateScenario(sid, scFields(fd));
  revalidatePath(`/lab/${id}`); redirect(`/lab/${id}?sc=${sid}#scenarios`);
}
export async function deleteScenarioAction(fd: FormData) {
  await requireUser();
  const id = int(fd, "id")!;
  const { deleteScenario } = await import("@/lib/repo/lab");
  deleteScenario(int(fd, "scenario_id")!);
  back(id, "#scenarios");
}
export async function chooseScenarioAction(fd: FormData) {
  await requireUser();
  const id = int(fd, "id")!, sid = int(fd, "scenario_id");
  const { setChosenScenario } = await import("@/lib/repo/lab");
  setChosenScenario(id, sid);
  revalidatePath(`/lab/${id}`); redirect(`/lab/${id}${sid ? `?sc=${sid}` : ""}#scenarios`);
}
export async function saveProposalAction(fd: FormData) {
  await requireUser();
  const id = int(fd, "id")!;
  const { saveProposal, PROPOSAL } = await import("@/lib/repo/lab");
  const patch: Record<string, string> = {};
  for (const k of ["title", "subtitle", ...PROPOSAL.map((x) => x.k)]) if (fd.has(`p_${k}`)) patch[k] = String(fd.get(`p_${k}`) ?? "");
  saveProposal(id, patch);
  if (fd.has("from")) { const { setSetting } = await import("@/lib/repo/settings"); setSetting("proposal.from", str(fd, "from")); }
  back(id, "#proposal");
}

// ---- Режим «рішення»: продукти, етапи
export async function setModeAction(fd: FormData) {
  await requireUser();
  const id = int(fd, "id")!;
  const { setLabMode } = await import("@/lib/repo/lab");
  setLabMode(id, str(fd, "mode") === "solution" ? "solution" : "choose");
  back(id);
}
const prFields = (fd: FormData) => ({
  name: str(fd, "name"), about: str(fd, "about"), ptype: str(fd, "ptype") as "ours", notes: str(fd, "notes"),
  price_setup: price(fd, "price_setup"), price_month: price(fd, "price_month"), cost_setup: price(fd, "cost_setup"), cost_month: price(fd, "cost_month"),
  includes: String(fd.get("includes") ?? "").trim(), market_setup: price(fd, "market_setup"), market_month: price(fd, "market_month"),
});
export async function saveProductAction(fd: FormData) {
  await requireUser();
  const id = int(fd, "id")!, pid = int(fd, "product_id");
  const r = await import("@/lib/repo/lab");
  const f = prFields(fd);
  if (pid) r.updateProduct(pid, f); else if (f.name) r.addProduct(id, f);
  back(id, "#products");
}
export async function deleteProductAction(fd: FormData) {
  await requireUser();
  const id = int(fd, "id")!;
  const { deleteProduct } = await import("@/lib/repo/lab");
  deleteProduct(int(fd, "product_id")!);
  back(id, "#products");
}
export async function saveStageAction(fd: FormData) {
  await requireUser();
  const id = int(fd, "id")!, sid = int(fd, "stage_id");
  const r = await import("@/lib/repo/lab");
  const f = { title: str(fd, "title"), steps_md: String(fd.get("steps_md") ?? ""), result: str(fd, "result"), duration: str(fd, "duration"), product_id: int(fd, "product_id") };
  if (sid) r.updateStage(sid, f); else if (f.title) r.addStage(id, f);
  back(id, "#stages");
}
export async function deleteStageAction(fd: FormData) {
  await requireUser();
  const id = int(fd, "id")!;
  const { deleteStage } = await import("@/lib/repo/lab");
  deleteStage(int(fd, "stage_id")!);
  back(id, "#stages");
}

// ── Пакети послуг і «Мої послуги»
export async function savePackageAction(fd: FormData) {
  await requireUser();
  const id = int(fd, "id")!;
  const { savePackage } = await import("@/lib/repo/lab");
  const name = str(fd, "name");
  if (name) savePackage(id, { id: int(fd, "package_id"), name, tagline: str(fd, "tagline"), price_setup: price(fd, "price_setup"), price_month: price(fd, "price_month"), highlight: fd.get("highlight") === "on", product_ids: fd.getAll("product_ids").map(Number).filter(Boolean) });
  back(id, "#packages");
}
export async function deletePackageAction(fd: FormData) {
  await requireUser();
  const id = int(fd, "id")!;
  const { deletePackage } = await import("@/lib/repo/lab");
  deletePackage(int(fd, "package_id")!);
  back(id, "#packages");
}
export async function choosePackageAction(fd: FormData) {
  await requireUser();
  const id = int(fd, "id")!;
  const { choosePackage } = await import("@/lib/repo/lab");
  choosePackage(id, int(fd, "package_id"));
  back(id, "#bill");
}
export async function productToTemplateAction(fd: FormData) {
  await requireUser();
  const id = int(fd, "id")!;
  const { getProduct, productToTemplate } = await import("@/lib/repo/lab");
  const p = getProduct(int(fd, "product_id")!);
  if (p) productToTemplate(p);
  back(id, "#products");
}
export async function addFromTemplateAction(fd: FormData) {
  await requireUser();
  const id = int(fd, "id")!;
  const { templateToProduct } = await import("@/lib/repo/lab");
  for (const t of fd.getAll("template_id").map(Number).filter(Boolean)) templateToProduct(id, t);
  back(id, "#products");
}
export async function deleteTemplateAction(fd: FormData) {
  await requireUser();
  const { deleteTemplate } = await import("@/lib/repo/lab");
  deleteTemplate(int(fd, "del_template")!);
  const id = int(fd, "id");
  if (id) back(id, "#products"); else revalidatePath("/lab");
}
