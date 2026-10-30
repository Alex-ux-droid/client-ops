"use client";
import { openTask } from "./tasks";

// Клікабельна частина рядка задачі — відкриває вікно задачі
export default function TaskOpen({ id, children, className }: { id: number; children: React.ReactNode; className?: string }) {
  return (
    <div className={className} role="button" tabIndex={0} onClick={(e) => { if (!(e.target as HTMLElement).closest("a,button,form,details,input")) openTask(id); }}
      onKeyDown={(e) => { if (e.key === "Enter" && e.target === e.currentTarget) openTask(id); }}>
      {children}
    </div>
  );
}
