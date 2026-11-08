"use client";
// Галочка задачі в списку. Якщо не всі пункти виконані — питає «закрити з N/M?» і причину (піде в історію).
import { setTask } from "@/app/actions";

export default function TaskCheck({ id, done, ok, total }: { id: number; done: boolean; ok: number; total: number }) {
  return (
    <form action={setTask} onSubmit={(e) => {
      if (done || !total || ok >= total) return;
      const r = window.prompt(`Закрити з ${ok}/${total} пунктів? Чому решта не потрібна (піде в історію):`, "");
      if (r === null) { e.preventDefault(); return; }
      (e.currentTarget.elements.namedItem("reason") as HTMLInputElement).value = `закрито з ${ok}/${total}${r.trim() ? `: ${r.trim()}` : ""}`;
    }}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={done ? "todo" : "done"} />
      <input type="hidden" name="reason" value="" />
      <button className={`check ${done ? "done" : ""}`} title={done ? "Повернути" : "Виконано"}>✓</button>
    </form>
  );
}
