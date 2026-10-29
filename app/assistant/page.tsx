import { redirect } from "next/navigation";

// Окремої сторінки помічника нема: він один — робот на кожному екрані
export default function AssistantPage() {
  redirect("/");
}
