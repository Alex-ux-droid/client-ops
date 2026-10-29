export type Counts = { tasks: number; leads: number; debts: number; ideas: number; journal: number };

// Пункти меню: бокова панель на компʼютері і сторінка /menu на телефоні
export const SECTIONS: { title: string; items: { href: string; label: string; ico: string; count?: keyof Counts; bad?: boolean }[] }[] = [
  {
    title: "Робота",
    items: [
      { href: "/", label: "Центр", ico: "◎" },
      { href: "/assistant", label: "Помічник", ico: "◉" },
      { href: "/tasks", label: "Задачі", ico: "▣", count: "tasks" },
      { href: "/clients", label: "Клієнти", ico: "◇" },
      { href: "/pipeline", label: "Воронка", ico: "⟩", count: "leads" },
      { href: "/money", label: "Гроші", ico: "◈", count: "debts", bad: true },
    ],
  },
  {
    title: "Знання",
    items: [
      { href: "/playbooks", label: "Плейбуки", ico: "☰" },
      { href: "/ideas", label: "Ідеї", ico: "✦", count: "ideas" },
      { href: "/journal", label: "Журнал системи", ico: "✎", count: "journal" },
      { href: "/settings", label: "Налаштування", ico: "⚙" },
    ],
  },
];
