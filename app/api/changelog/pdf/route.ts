import { NextResponse, type NextRequest } from "next/server";
import { markdownToPdf } from "@/lib/pdf";
import { listChangelog } from "@/lib/repo/changelog";
import { isAuthed, SESSION_COOKIE } from "@/lib/session";

// PDF з оновленнями системи: ?days=1 — сьогодні (за Києвом), 7 — тиждень, 0 — усі
export async function GET(req: NextRequest) {
  if (!isAuthed(req.cookies.get(SESSION_COOKIE)?.value, req.headers.get("authorization"))) return NextResponse.json({ error: "Потрібен вхід" }, { status: 401 });
  const days = Math.max(0, Number(req.nextUrl.searchParams.get("days") ?? 1) || 0);
  const kyiv = (iso: string) => new Date(iso.replace(" ", "T") + "Z").toLocaleString("sv-SE", { timeZone: "Europe/Kyiv" }).slice(0, 10);
  const from = days ? new Date(Date.now() - (days - 1) * 86400_000).toLocaleString("sv-SE", { timeZone: "Europe/Kyiv" }).slice(0, 10) : "";
  const list = listChangelog(200).filter((e) => !from || kyiv(e.created_at) >= from).reverse();
  const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("uk-UA", { day: "numeric", month: "long" });
  const title = days === 1 ? `Оновлення системи — ${fmt(from)}` : days ? `Оновлення системи за ${days} дн.` : "Усі оновлення системи";
  const md = list.length ? list.map((e) => `## ${e.title}\n${e.body}`).join("\n\n") : "За цей період оновлень не було.";
  const pdf = await markdownToPdf(title, md);
  return new Response(new Uint8Array(pdf), { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(title)}.pdf`, "cache-control": "no-store" } });
}
