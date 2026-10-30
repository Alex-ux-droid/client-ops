// Каталог послуг. Увімкнена послуга відкриває вкладку в картці клієнта з цими полями.
export type FieldType = "text" | "url" | "textarea" | "date" | "number";
export type ServiceField = { key: string; label: string; type: FieldType; placeholder?: string; wide?: boolean };
export type ToolCategory = "crm" | "telephony" | "site" | "hosting";

export type ServiceDef = {
  label: string;
  short: string;
  group: "Реклама" | "Сайт і продажі" | "Команда";
  ico: string;
  hint: string;
  tool?: { category: ToolCategory; label: string };
  adPlatform?: string;   // для рекламних: значення ad_stats.platform
  folder?: string;       // яку папку клієнта показувати кнопкою
  fields: ServiceField[];
};

export const SERVICES = {
  meta_ads: {
    label: "Meta Ads", short: "Meta", group: "Реклама", ico: "Ⓜ", hint: "Facebook та Instagram", adPlatform: "facebook", folder: "creatives",
    fields: [
      { key: "account_id", label: "ID рекламного кабінету", type: "text", placeholder: "act_123456789" },
      { key: "business_manager", label: "Business Manager", type: "text" },
      { key: "pixel", label: "Піксель / Conversions API", type: "text" },
      { key: "budget", label: "Бюджет на місяць", type: "number" },
      { key: "pages", label: "Сторінки FB / IG", type: "text", wide: true },
      { key: "strategy", label: "Стратегія і що зараз крутиться", type: "textarea", wide: true },
    ],
  },
  google_ads: {
    label: "Google Ads", short: "Google", group: "Реклама", ico: "G", hint: "Пошук, Performance Max, YouTube", adPlatform: "google", folder: "creatives",
    fields: [
      { key: "account_id", label: "ID акаунта Google Ads", type: "text", placeholder: "123-456-7890" },
      { key: "analytics", label: "GA4 / GTM", type: "text" },
      { key: "budget", label: "Бюджет на місяць", type: "number" },
      { key: "conversions", label: "Що рахуємо конверсією", type: "text" },
      { key: "strategy", label: "Стратегія і кампанії", type: "textarea", wide: true },
    ],
  },
  tiktok_ads: {
    label: "TikTok Ads", short: "TikTok", group: "Реклама", ico: "♪", hint: "TikTok Business", adPlatform: "tiktok", folder: "creatives",
    fields: [
      { key: "account_id", label: "ID рекламного кабінету", type: "text" },
      { key: "budget", label: "Бюджет на місяць", type: "number" },
      { key: "strategy", label: "Стратегія", type: "textarea", wide: true },
    ],
  },
  website: {
    label: "Сайт", short: "Сайт", group: "Сайт і продажі", ico: "◫", hint: "Розробка, підтримка, доопрацювання", folder: "website",
    tool: { category: "site", label: "На чому зроблено" },
    fields: [
      { key: "url", label: "Адреса сайту", type: "url", placeholder: "https://" },
      { key: "admin_url", label: "Адмінка (посилання, без пароля)", type: "url" },
      { key: "hosting", label: "Хостинг", type: "text" },
      { key: "domain", label: "Домен: де куплений, до коли", type: "text" },
      { key: "launched_at", label: "Дата запуску", type: "date" },
      { key: "work", label: "Що ми зробили на сайті", type: "textarea", wide: true },
    ],
  },
  crm: {
    label: "CRM", short: "CRM", group: "Сайт і продажі", ico: "▤", hint: "Впровадження і налаштування CRM",
    tool: { category: "crm", label: "Яка CRM" },
    fields: [
      { key: "url", label: "Посилання на CRM", type: "url" },
      { key: "users", label: "Скільки користувачів", type: "number" },
      { key: "integrations", label: "Інтеграції (сайт, ліди з реклами, пошта)", type: "text", wide: true },
      { key: "setup", label: "Що налаштовано: воронки, поля, автоматизації", type: "textarea", wide: true },
    ],
  },
  telephony: {
    label: "Телефонія", short: "Телефонія", group: "Сайт і продажі", ico: "☏", hint: "IP-телефонія, коллтрекінг",
    tool: { category: "telephony", label: "Сервіс телефонії" },
    fields: [
      { key: "numbers", label: "Номери", type: "text" },
      { key: "integration", label: "Інтеграція з CRM", type: "text" },
      { key: "setup", label: "Що налаштовано: черги, запис, сценарії", type: "textarea", wide: true },
    ],
  },
  sales_training: {
    label: "Навчання продажників", short: "Навчання", group: "Команда", ico: "◎", hint: "Скрипти, навчання, контроль",
    fields: [
      { key: "team", label: "Хто в команді продажу", type: "textarea", wide: true },
      { key: "scripts_url", label: "Скрипти (посилання)", type: "url" },
      { key: "program", label: "Програма і результати навчання", type: "textarea", wide: true },
    ],
  },
  automation: {
    label: "Автоматизація", short: "Автоматизація", group: "Команда", ico: "⚙", hint: "Боти, інтеграції, ШІ-агенти",
    fields: [
      { key: "what", label: "Що автоматизуємо", type: "textarea", wide: true },
      { key: "links", label: "Посилання (боти, сервіси)", type: "text", wide: true },
    ],
  },
} satisfies Record<string, ServiceDef>;

export type ServiceType = keyof typeof SERVICES;
export const SERVICE_TYPES = Object.keys(SERVICES) as ServiceType[];
export const isServiceType = (t: string): t is ServiceType => t in SERVICES;
export const serviceDef = (t: ServiceType): ServiceDef => SERVICES[t];

export const TOOL_CATEGORY_LABEL: Record<ToolCategory, string> = {
  crm: "CRM-системи", telephony: "Телефонія", site: "Платформи сайтів", hosting: "Хостинги",
};

// Стандартні папки клієнта
export const FOLDER_KINDS = [
  { kind: "creatives", title: "Креативи" },
  { kind: "data", title: "Дані і звіти" },
  { kind: "portfolio", title: "Портфоліо" },
  { kind: "docs", title: "Документи" },
  { kind: "website", title: "Сайт" },
  { kind: "telegram", title: "Telegram" },
] as const;
