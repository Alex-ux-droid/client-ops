export type Counts = { tasks: number; leads: number; debts: number; ideas: number; journal: number };

// Пункти меню: бокова панель на компʼютері і сторінка /menu на телефоні
export const SECTIONS: { title: string; items: { href: string; label: string; ico: string; count?: keyof Counts; bad?: boolean }[] }[] = [
  {
    title: "Робота",
    items: [
      { href: "/", label: "Центр", ico: "home" },
      { href: "/assistant", label: "Помічник", ico: "bot" },
      { href: "/tasks", label: "Задачі", ico: "tasks", count: "tasks" },
      { href: "/clients", label: "Клієнти", ico: "users" },
      { href: "/pipeline", label: "Воронка", ico: "funnel", count: "leads" },
      { href: "/lab", label: "Лабораторія", ico: "flask" },
      { href: "/money", label: "Гроші", ico: "wallet", count: "debts", bad: true },
    ],
  },
  {
    title: "Знання",
    items: [
      { href: "/playbooks", label: "Плейбуки", ico: "book" },
      { href: "/ideas", label: "Ідеї", ico: "bulb", count: "ideas" },
      { href: "/journal", label: "Журнал системи", ico: "wrench", count: "journal" },
      { href: "/settings", label: "Налаштування", ico: "gear" },
    ],
  },
];
