"use server";
// Тижневий рев'ю: зберегти рішення (чернетка) або закрити тиждень (знімок + задачі з рішень)
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { addDays, ymd } from "@/lib/dates";
import { closeReview, reviewRows, saveDecision, setDecisionTask, weekMoney } from "@/lib/repo/review";
import { createTask } from "@/lib/repo/tasks";

export async function reviewSaveAction(fd: FormData) {
  await requireUser();
  const week = String(fd.get("week") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) return;
  const ids = fd.getAll("client_id").map(Number).filter(Boolean);
  for (const id of ids) saveDecision(week, id, String(fd.get(`decision_${id}`) ?? "").trim(), fd.get(`task_${id}`) === "on");
  if (fd.get("op") !== "close") { revalidatePath("/review"); redirect(`/review?w=${week}&saved=1`); }
  const rows = reviewRows(week);
  const missing = rows.filter((r) => !r.decision.trim()).map((r) => r.name);
  if (missing.length) redirect(`/review?w=${week}&err=${encodeURIComponent(`Нема рішення на тиждень: ${missing.join(", ")}`)}`);
  for (const r of rows) {
    if (r.to_task && !r.task_id) {
      const tid = createTask({ client_id: r.client_id, title: r.decision.split("\n")[0].slice(0, 200), details: `## Звідки\nРішення тижневого рев'ю ${week}.`, due_date: addDays(7) });
      setDecisionTask(week, r.client_id, tid);
    }
  }
  closeReview(week, { rows: reviewRows(week), money: weekMoney(week), closed: ymd() });
  revalidatePath("/", "layout");
  redirect(`/review?w=${week}&closed=1`);
}
