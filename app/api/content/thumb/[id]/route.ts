import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { driveThumb } from "@/lib/google";
import { getAsset } from "@/lib/repo/content";

// Прев'ю матеріалу з Диску: кешуємо на диску сервера (data/thumbs), щоб не смикати Google щоразу. Сторінка закрита proxy.ts.
const DIR = path.join(process.cwd(), "data", "thumbs");
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = getAsset(Number((await params).id));
  if (!a) return new NextResponse("not found", { status: 404 });
  const file = path.join(DIR, `${a.drive_id.replace(/[^\w-]/g, "")}.img`);
  const headers = { "cache-control": "private, max-age=86400" };
  if (fs.existsSync(file)) return new NextResponse(fs.readFileSync(file), { headers: { ...headers, "content-type": "image/jpeg" } });
  const t = await driveThumb(a.drive_id).catch(() => null);
  if (!t) return new NextResponse("no preview", { status: 404 });
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(file, Buffer.from(t.body));
  return new NextResponse(Buffer.from(t.body), { headers: { ...headers, "content-type": t.type } });
}
