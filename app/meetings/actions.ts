"use server";
// Зустрічі з клієнтом: автозбереження тез, «Розібрано», видалити
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { deleteMeeting, getMeeting, saveMeeting, setMeetingStatus } from "@/lib/repo/meetings";

export async function saveMeetingAction(clientId: number, id: number, title: string, notes: string): Promise<number> {
  await requireUser();
  if (!id && !notes.trim()) return 0;
  return saveMeeting(clientId, id, title.trim() || "Зустріч", notes);
}
export async function meetingStatusAction(fd: FormData) {
  await requireUser();
  const m = getMeeting(Number(fd.get("meeting_id")));
  if (!m) return;
  if (fd.get("op") === "delete") deleteMeeting(m.id);
  else setMeetingStatus(m.id, fd.get("op") === "reopen" ? "new" : "done");
  revalidatePath(`/clients/${m.client_id}`);
}
export async function refreshClientAction(clientId: number) {
  await requireUser();
  revalidatePath(`/clients/${clientId}`);
}
