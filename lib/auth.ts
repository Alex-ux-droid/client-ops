// Заглушка під майбутній логін. Зараз завжди повертає єдиного користувача.
// Коли додамо авторизацію: тут читати сесію і кидати помилку, якщо її нема.
export type User = { id: number; name: string };

export async function requireUser(): Promise<User> {
  return { id: 1, name: "Саша" };
}
