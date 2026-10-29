import { NextResponse, type NextRequest } from "next/server";
import { isAuthed, SESSION_COOKIE } from "@/lib/session";
import { searchAll } from "@/lib/repo/search";

export async function GET(req: NextRequest) {
  if (!isAuthed(req.cookies.get(SESSION_COOKIE)?.value, req.headers.get("authorization"))) return NextResponse.json([], { status: 401 });
  return NextResponse.json(searchAll(req.nextUrl.searchParams.get("q") ?? ""));
}
