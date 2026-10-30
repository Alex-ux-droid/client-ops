import { NextResponse, type NextRequest } from "next/server";
import { downloadFile, googleConnected } from "@/lib/google";
import { logError } from "@/lib/log";
import { getTgFile } from "@/lib/repo/telegram";
import { isAuthed, SESSION_COOKIE } from "@/lib/session";
import { fileBlob, TG_FILE_LIMIT } from "@/lib/telegram";

// Фото/файл з Telegram-групи: з Диску, якщо вже там, інакше напряму з Telegram
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!isAuthed(req.cookies.get(SESSION_COOKIE)?.value, req.headers.get("authorization"))) return NextResponse.json({ error: "Потрібен вхід" }, { status: 401 });
  const f = getTgFile(Number((await ctx.params).id));
  if (!f || !f.tg_file_id) return NextResponse.json({ error: "Файлу нема" }, { status: 404 });
  if (f.file_size > TG_FILE_LIMIT) return NextResponse.json({ error: "Файл більший за 20 МБ — бот його не скачає, відкрий у Telegram" }, { status: 413 });
  const headers: Record<string, string> = { "content-type": f.mime || "application/octet-stream", "cache-control": "private, max-age=604800" };
  if (f.kind !== "photo") headers["content-disposition"] = `inline; filename*=UTF-8''${encodeURIComponent(f.file_name || "file")}`;
  try {
    if (f.drive_id && googleConnected()) {
      const r = await downloadFile(f.drive_id).catch(() => null);
      if (r?.body) return new Response(r.body, { headers });
    }
    return new Response(await fileBlob(f.tg_file_id), { headers });
  } catch (e) {
    logError("telegram-file", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Не вдалось" }, { status: 502 });
  }
}
