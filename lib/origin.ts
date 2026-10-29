import type { NextRequest } from "next/server";

// Публічна адреса, з якої зайшов Саша (за Caddy). Потрібна для redirect URI Google.
export function publicOrigin(req: NextRequest): string {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || req.nextUrl.host;
  const proto = req.headers.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
