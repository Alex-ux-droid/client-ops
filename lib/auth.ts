// Перевірка входу. Кожен server action викликає requireUser().
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySession } from "./session";

export type User = { id: number; name: string };

export async function requireUser(): Promise<User> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!verifySession(token)) redirect("/login");
  return { id: 1, name: "Саша" };
}
