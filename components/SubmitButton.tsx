"use client";
import { useFormStatus } from "react-dom";

// Кнопка форми, яка показує, що збереження йде
export default function SubmitButton({ children = "Зберегти", className, pendingText = "Зберігаю…", disabled = false }: { children?: React.ReactNode; className?: string; pendingText?: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return <button className={className} disabled={pending || disabled}>{pending ? pendingText : children}</button>;
}
