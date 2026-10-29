"use client";
import { useFormStatus } from "react-dom";

// Кнопка форми, яка показує, що збереження йде
export default function SubmitButton({ children = "Зберегти", className }: { children?: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return <button className={className} disabled={pending}>{pending ? "Зберігаю…" : children}</button>;
}
