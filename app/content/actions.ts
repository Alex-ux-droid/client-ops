"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { folderIdFromUrl } from "@/lib/google";
import { saveSocial } from "@/lib/repo/social";

// Вкладка «Контент»: куди публікуємо (сторінка + IG) і папка матеріалів на Диску
export async function saveSocialAction(fd: FormData) {
  await requireUser();
  const cid = Number(fd.get("client_id"));
  if (!cid) return;
  const page = String(fd.get("page") ?? "");
  if (fd.has("page")) {
    const [page_id = "", ig_id = "", ig_username = "", ...name] = page.split("|");
    saveSocial(cid, { page_id, ig_id, ig_username, page_name: name.join("|") });
  }
  if (fd.has("drive")) {
    const url = String(fd.get("drive") ?? "").trim();
    saveSocial(cid, { drive_folder_url: url, drive_folder_id: folderIdFromUrl(url) ?? (/^[\w-]{20,}$/.test(url) ? url : "") });
  }
  revalidatePath(`/clients/${cid}`);
}
