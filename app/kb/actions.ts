"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { deleteKb, saveKb } from "@/lib/repo/kb";

export async function saveKbAction(fd: FormData) {
  await requireUser();
  const id = Number(fd.get("id")) || null;
  const title = String(fd.get("title") ?? "").trim() || "Без назви";
  const category = String(fd.get("category") ?? "").trim() || "Інструкції";
  const body = String(fd.get("body_md") ?? "");
  const saved = saveKb({ id, title, category, body_md: body });
  revalidatePath("/kb");
  redirect(`/kb/${saved}`);
}

export async function deleteKbAction(fd: FormData) {
  await requireUser();
  deleteKb(Number(fd.get("id")));
  revalidatePath("/kb");
  redirect("/kb");
}
