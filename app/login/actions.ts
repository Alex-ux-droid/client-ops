"use server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSession, passwordMatches, SESSION_COOKIE, SESSION_DAYS } from "@/lib/session";

// Захист від перебору: після 5 помилок з однієї IP пауза 15 хв для цієї IP
// (раніше блок був спільний — чужий міг безкінечно не пускати Сашу).
const g = globalThis as unknown as { __loginFails?: Map<string, { n: number; until: number }> };

export async function login(_: string | null, fd: FormData): Promise<string | null> {
  const fails = (g.__loginFails ??= new Map());
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0].trim() || "local";
  if (fails.size > 5000) fails.clear();
  const f = fails.get(ip) ?? { n: 0, until: 0 };
  fails.set(ip, f);
  if (Date.now() < f.until) return "Забагато спроб. Спробуй через 15 хвилин.";
  if (!process.env.APP_PASSWORD || !createSession()) return "Вхід не налаштовано на сервері (APP_PASSWORD / SESSION_SECRET).";

  if (!passwordMatches(String(fd.get("password") ?? ""))) {
    f.n += 1;
    if (f.n >= 5) { f.n = 0; f.until = Date.now() + 15 * 60_000; }
    await new Promise((r) => setTimeout(r, 800));
    return "Невірний пароль.";
  }
  f.n = 0;
  (await cookies()).set(SESSION_COOKIE, createSession()!, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
  redirect("/");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
