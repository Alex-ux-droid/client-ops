import { redirect } from "next/navigation";

// Воронку прибрали (Саша працює з кількома великими клієнтами) — старі посилання ведуть до клієнтів
export default function Pipeline() {
  redirect("/clients");
}
