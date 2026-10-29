// Перевірка входу. Кожен server action викликає requireUser().
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { isAuthed, SESSION_COOKIE } from "./session";

export type User = { id: number; name: string };

export async function requireUser(): Promise<User> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!isAuthed(token, (await headers()).get("authorization"))) redirect("/login");
  return { id: 1, name: "Саша" };
}
