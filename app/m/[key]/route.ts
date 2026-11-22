import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { MEDIA_DIR, postFromKey } from "@/lib/contentPipeline";

// Публічне посилання на готовий файл поста (для Meta і прев'ю в Telegram): /m/<id>-<підпис>.jpg. Без входу (proxy пропускає m/), тільки з правильним підписом.
export async function GET(_: Request, { params }: { params: Promise<{ key: string }> }) {
  const id = postFromKey((await params).key.replace(/\.jpg$/, ""));
  if (id == null) return new NextResponse("not found", { status: 404 });
  const file = path.join(MEDIA_DIR, `${id}.jpg`);
  if (!fs.existsSync(file)) return new NextResponse("not found", { status: 404 });
  return new NextResponse(fs.readFileSync(file), { headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=300" } });
}
