import { NextResponse, type NextRequest } from "next/server";
import { exportMarkdown, listDev, markExported } from "@/lib/repo/devlog";
import { isAuthed, SESSION_COOKIE } from "@/lib/session";
import { systemInfo } from "@/lib/system";

const auth = (req: NextRequest) => isAuthed(req.cookies.get(SESSION_COOKIE)?.value, req.headers.get("authorization"));
const build = () => {
  const entries = listDev("new");
  const s = systemInfo();
  return { entries, md: exportMarkdown(entries, { commit: s.commit, counts: s.counts }) };
};

// GET — тільки текст (для «Копіювати»), нічого не змінює
export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: "Потрібен вхід" }, { status: 401 });
  return new NextResponse(build().md, { headers: { "content-type": "text/markdown; charset=utf-8" } });
}

// POST — файл для завантаження; записи переходять в архів
export async function POST(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: "Потрібен вхід" }, { status: 401 });
  const { entries, md } = build();
  markExported(entries.map((e) => e.id));
  const name = `client-ops-journal-${new Date().toISOString().slice(0, 10)}.md`;
  return new NextResponse(md, {
    headers: { "content-type": "text/markdown; charset=utf-8", "content-disposition": `attachment; filename="${name}"` },
  });
}
