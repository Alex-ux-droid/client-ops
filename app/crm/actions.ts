"use server";
// Підключення CRM клієнта: адреса, ключ (у .env), секрет вебхука (у .env), підтягування
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { crmCheck, crmKey, crmPull, crmSecret, newCrmSecret, setCrmKey } from "@/lib/crm";
import { deleteCrmLink, getCrmLink, saveCrmLink } from "@/lib/repo/crm";
import { setSetting } from "@/lib/repo/settings";
import { setEnvVar } from "@/lib/secrets";
import { linkCrmProduct as linkOselya } from "@/lib/repo/products";

const back = (id: number, q = "") => `/clients/${id}?tab=sales${q}`;
const err = (e: unknown) => encodeURIComponent(e instanceof Error ? e.message : "помилка");

export async function connectCrmAction(fd: FormData) {
  await requireUser();
  const id = Number(fd.get("client_id"));
  const url = String(fd.get("base_url") ?? "").trim().replace(/\/+$/, "");
  const key = String(fd.get("key") ?? "").trim();
  if (!id || !(/^https:\/\/[^\s/]+\.[^\s]+$/.test(url) || (process.env.NODE_ENV !== "production" && /^http:\/\/localhost:\d+/.test(url)))) redirect(back(id, "&err=" + encodeURIComponent("Адреса має бути https://… (з документа CRM)")));
  if (!key && !crmKey(id)) redirect(back(id, "&err=" + encodeURIComponent("Встав ключ API з CRM")));
  if (key && (key.length < 16 || /\s/.test(key))) redirect(back(id, "&err=" + encodeURIComponent("Ключ схожий на неповний — скопіюй ще раз")));
  const prevUrl = getCrmLink(id)?.base_url;
  saveCrmLink(id, url);
  if (key) setCrmKey(id, key);
  if (!crmSecret(id)) setSetting(`crm.secret_once.${id}`, newCrmSecret(id));
  let msg = "";
  try { await crmCheck(id); } catch (e) {
    if (!prevUrl) { deleteCrmLink(id); if (key) setCrmKey(id, null); }
    redirect(back(id, "&err=" + err(e)));
  }
  linkOselya(id);
  try { msg = `&pulled=${await crmPull(id)}`; } catch (e) { msg = "&err=" + err(e); }
  revalidatePath(`/clients/${id}`);
  redirect(back(id, msg));
}

export async function crmSecretAction(fd: FormData) {
  await requireUser();
  const id = Number(fd.get("client_id"));
  if (fd.get("op") === "hide") setSetting(`crm.secret_once.${id}`, "");
  else setSetting(`crm.secret_once.${id}`, newCrmSecret(id));
  revalidatePath(`/clients/${id}`);
}

export async function crmPullAction(fd: FormData) {
  await requireUser();
  const id = Number(fd.get("client_id"));
  let q = "";
  try { q = `&pulled=${await crmPull(id)}`; } catch (e) { q = "&err=" + err(e); }
  revalidatePath(`/clients/${id}`);
  redirect(back(id, q));
}

export async function crmDisconnectAction(fd: FormData) {
  await requireUser();
  const id = Number(fd.get("client_id"));
  deleteCrmLink(id);
  setEnvVar(`CRM_KEY_${id}`, null);
  setEnvVar(`CRM_SECRET_${id}`, null);
  setSetting(`crm.secret_once.${id}`, "");
  revalidatePath(`/clients/${id}`);
  redirect(back(id));
}

export async function crmNotManagersAction(fd: FormData) {
  await requireUser();
  const id = Number(fd.get("client_id"));
  const names = String(fd.get("names") ?? "").split(/[\n,]/).map((x) => x.trim()).filter(Boolean).slice(0, 20);
  if (id) setSetting(`crm.not_managers.${id}`, names.join(", "));
  revalidatePath(`/clients/${id}`);
  redirect(back(id));
}
