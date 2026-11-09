export type Counts = { tasks: number; leads: number; debts: number; ideas: number; journal: number };

// Пункти меню: бокова панель на компʼютері і сторінка /menu на телефоні
// «Особисте» згорнуте за замовчуванням (розгортається, коли відкрита сторінка з нього)
export const SECTIONS: { title: string; collapsed?: boolean; items: { href: string; label: string; ico: string; count?: keyof Counts; bad?: boolean }[] }[] = [
  {
    title: "Робота",
    items: [
      { href: "/", label: "Центр", ico: "home" },
      { href: "/review", label: "Рев'ю", ico: "flag" },
      { href: "/tasks", label: "Задачі", ico: "tasks", count: "tasks" },
      { href: "/clients", label: "Клієнти", ico: "users" },
      { href: "/money", label: "Гроші", ico: "wallet", count: "debts", bad: true },
      { href: "/ads", label: "Реклама", ico: "megaphone" },
      { href: "/products", label: "Проєкти", ico: "box" },
    ],
  },
  {
    title: "Особисте",
    collapsed: true,
    items: [
      { href: "/startups", label: "Стартапи", ico: "rocket" },
      { href: "/kb", label: "Розвиток", ico: "compass" },
      { href: "/ideas", label: "Ідеї", ico: "bulb", count: "ideas" },
    ],
  },
  {
    title: "Знання",
    items: [
      { href: "/journal", label: "Журнал системи", ico: "wrench", count: "journal" },
      { href: "/settings", label: "Налаштування", ico: "gear" },
    ],
  },
];
