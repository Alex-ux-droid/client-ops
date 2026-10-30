import { NextResponse, type NextRequest } from "next/server";
import { calendarAllowed, googleConnected } from "@/lib/google";
import { getClient } from "@/lib/repo/clients";
import { getTask, taskItems, taskLinks } from "@/lib/repo/tasks";
import { isAuthed, SESSION_COOKIE } from "@/lib/session";

// Повна задача для вікна задачі: сама задача, підзадачі, посилання, папка клієнта
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!isAuthed(req.cookies.get(SESSION_COOKIE)?.value, req.headers.get("authorization"))) return NextResponse.json({ error: "Потрібен вхід" }, { status: 401 });
  const id = Number((await ctx.params).id);
  const task = getTask(id);
  if (!task) return NextResponse.json({ error: "Задачі нема" }, { status: 404 });
  const client = task.client_id ? getClient(task.client_id) : undefined;
  return NextResponse.json({ task, items: taskItems(id), links: taskLinks(id), drive_url: client?.drive_url ?? "", calendar: calendarAllowed() ? "ok" : googleConnected() ? "reconnect" : "off" }, { headers: { "cache-control": "no-store" } });
}
