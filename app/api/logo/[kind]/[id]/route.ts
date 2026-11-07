import { NextResponse, type NextRequest } from "next/server";
import { saveFile } from "@/lib/repo/files";
import { isLogoKind, removeLogo, setLogo } from "@/lib/repo/logos";
import { isAuthed, SESSION_COOKIE } from "@/lib/session";

// Логотип продукту/клієнта/стартапу: POST — завантажити (картинка до 5 МБ), DELETE — прибрати
type Ctx = { params: Promise<{ kind: string; id: string }> };
const auth = (req: NextRequest) => isAuthed(req.cookies.get(SESSION_COOKIE)?.value, req.headers.get("authorization"));

export async function POST(req: NextRequest, ctx: Ctx) {
  if (!auth(req)) return NextResponse.json({ error: "Потрібен вхід" }, { status: 401 });
  const { kind, id } = await ctx.params;
  if (!isLogoKind(kind) || !Number(id)) return NextResponse.json({ error: "Невірна адреса" }, { status: 400 });
  const fd = await req.formData().catch(() => null);
  const f = fd?.get("file");
  if (!(f instanceof File) || !f.size) return NextResponse.json({ error: "Обери картинку" }, { status: 400 });
  if (!/^image\//.test(f.type) && !/\.(svg|png|jpe?g|webp)$/i.test(f.name)) return NextResponse.json({ error: "Потрібна картинка: PNG, SVG, JPG або WEBP" }, { status: 400 });
  if (f.size > 5 * 1024 * 1024) return NextResponse.json({ error: "Завелика картинка (до 5 МБ)" }, { status: 400 });
  const mime = f.type || (f.name.endsWith(".svg") ? "image/svg+xml" : "image/png");
  const saved = saveFile({ name: f.name, mime, data: Buffer.from(await f.arrayBuffer()), client_id: kind === "client" ? Number(id) : null, source: "logo" });
  setLogo(kind, Number(id), saved.id);
  return NextResponse.json({ ok: true, src: `/api/files/${saved.id}` });
}
export async function DELETE(req: NextRequest, ctx: Ctx) {
  if (!auth(req)) return NextResponse.json({ error: "Потрібен вхід" }, { status: 401 });
  const { kind, id } = await ctx.params;
  if (!isLogoKind(kind)) return NextResponse.json({ error: "Невірна адреса" }, { status: 400 });
  removeLogo(kind, Number(id));
  return NextResponse.json({ ok: true });
}
