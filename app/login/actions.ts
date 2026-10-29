"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSession, passwordMatches, SESSION_COOKIE, SESSION_DAYS } from "@/lib/session";

// Простий захист від перебору: після 5 помилок пауза 15 хв.
const g = globalThis as unknown as { __loginFails?: { n: number; until: number } };

export async function login(_: string | null, fd: FormData): Promise<string | null> {
  const f = (g.__loginFails ??= { n: 0, until: 0 });
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
