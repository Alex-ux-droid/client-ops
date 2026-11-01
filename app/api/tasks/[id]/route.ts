import { NextResponse, type NextRequest } from "next/server";
import { calendarAllowed, googleConnected } from "@/lib/google";
import { getClient } from "@/lib/repo/clients";
import { listFolders } from "@/lib/repo/services";
import { getTask, taskItems, taskLinks } from "@/lib/repo/tasks";
import { isAuthed, SESSION_COOKIE } from "@/lib/session";

// Повна задача для вікна задачі: сама задача, підзадачі, посилання, папка клієнта
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!isAuthed(req.cookies.get(SESSION_COOKIE)?.value, req.headers.get("authorization"))) return NextResponse.json({ error: "Потрібен вхід" }, { status: 401 });
  const id = Number((await ctx.params).id);
  const task = getTask(id);
  if (!task) return NextResponse.json({ error: "Задачі нема" }, { status: 404 });
  const client = task.client_id ? getClient(task.client_id) : undefined;
  const folders = task.client_id ? listFolders(task.client_id).filter((f) => f.url) : [];
  // Яка папка клієнта потрібна для цієї задачі: за словами в назві й інструкції
  const txt = `${task.title} ${task.details ?? ""}`.toLowerCase();
  const RULES: [string, RegExp][] = [
    ["creatives", /креатив|банер|макет|сторіс|stories|reels|рілс|відео|фото|дизайн|оголошен/],
    ["website", /сайт|лендинг|landing|сторінк/],
    ["data", /звіт|цифр|статистик|таблиц|аналіт|дані/],
    ["docs", /договір|документ|рахун|комерційн/],
    ["portfolio", /портфоліо|кейс/],
  ];
  const best = RULES.map(([k, re]) => (re.test(txt) ? folders.find((f) => f.kind === k) : undefined)).find(Boolean) ?? null;
  return NextResponse.json({ task, items: taskItems(id), links: taskLinks(id), drive_url: client?.drive_url ?? "", folder: best ? { title: best.title, url: best.url } : null, folder_urls: folders.map((f) => f.url), calendar: calendarAllowed() ? "ok" : googleConnected() ? "reconnect" : "off" }, { headers: { "cache-control": "no-store" } });
}
