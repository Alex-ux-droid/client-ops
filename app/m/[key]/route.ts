import fs from "node:fs";
import { NextResponse } from "next/server";
import { mediaFile, postFromKey } from "@/lib/contentPipeline";

// Публічне посилання на готовий файл поста (для Meta і прев'ю в Telegram): /m/<id>-<підпис>.jpg. Без входу (proxy пропускає m/), тільки з правильним підписом.
export async function GET(_: Request, { params }: { params: Promise<{ key: string }> }) {
  // <id>-<підпис>.jpg — обкладинка/сторіс, <id>-<підпис>_<n>.jpg — слайд каруселі
  const m = (await params).key.replace(/\.jpg$/, "").match(/^(.+?)(?:_(\d{1,2}))?$/);
  const id = m ? postFromKey(m[1]) : null;
  if (id == null) return new NextResponse("not found", { status: 404 });
  const file = mediaFile(id, Number(m![2] ?? 0));
  if (!fs.existsSync(file)) return new NextResponse("not found", { status: 404 });
  return new NextResponse(fs.readFileSync(file), { headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=300" } });
}
