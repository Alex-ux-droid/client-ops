import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";
import { searchAll } from "@/lib/repo/search";

export async function GET(req: NextRequest) {
  if (!verifySession(req.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.json([], { status: 401 });
  return NextResponse.json(searchAll(req.nextUrl.searchParams.get("q") ?? ""));
}
