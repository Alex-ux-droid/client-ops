import fs from "node:fs";
import { NextResponse } from "next/server";
import { mediaFile, postFromKey, videoFile } from "@/lib/contentPipeline";

// Публічне посилання на готовий файл поста (для Meta і прев'ю в Telegram). Без входу (proxy пропускає m/), тільки з правильним підписом.
// <id>-<підпис>.jpg — обкладинка/сторіс, <id>-<підпис>_<n>.jpg — слайд каруселі, <id>-<підпис>.mp4 — Reels (з Range для плеєрів).
export async function GET(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const raw = (await params).key;
  const video = raw.endsWith(".mp4");
  const m = raw.replace(/\.(jpg|mp4)$/, "").match(/^(.+?)(?:_(\d{1,2}))?$/);
  const id = m ? postFromKey(m[1]) : null;
  if (id == null) return new NextResponse("not found", { status: 404 });
  const file = video ? videoFile(id) : mediaFile(id, Number(m![2] ?? 0));
  if (!fs.existsSync(file)) return new NextResponse("not found", { status: 404 });
  if (!video) return new NextResponse(fs.readFileSync(file), { headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=300" } });
  const buf = fs.readFileSync(file);
  const range = req.headers.get("range")?.match(/bytes=(\d*)-(\d*)/);
  const head = { "content-type": "video/mp4", "accept-ranges": "bytes", "cache-control": "public, max-age=300" };
  if (!range) return new NextResponse(buf, { headers: { ...head, "content-length": String(buf.length) } });
  const start = range[1] ? Number(range[1]) : Math.max(0, buf.length - Number(range[2]));
  const end = range[1] && range[2] ? Math.min(Number(range[2]), buf.length - 1) : buf.length - 1;
  if (start >= buf.length || start > end) return new NextResponse(null, { status: 416, headers: { "content-range": `bytes */${buf.length}` } });
  return new NextResponse(buf.subarray(start, end + 1), { status: 206, headers: { ...head, "content-range": `bytes ${start}-${end}/${buf.length}`, "content-length": String(end - start + 1) } });
}
