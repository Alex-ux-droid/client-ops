// Тумблери: що Джері може робити і що система робить сама. Налаштування → «Можливості».
// Зберігаються в settings: cap.<key> / auto.<key> = "off" вимикає; за замовчуванням усе увімкнено.
import { getSetting, setSetting } from "../repo/settings";

export const CAPS = [
  { key: "web", label: "Інтернет: пошук і читання сайтів", desc: "шукає в інтернеті і читає сторінки (GitHub, документація, сайти конкурентів); пошук ≈ 1 цент за запит", tools: [] },
  { key: "write", label: "Створювати і змінювати", desc: "клієнти, задачі, історія, гроші, ідеї, матеріали, послуги, плейбуки", tools: ["create_client", "update_client", "create_task", "update_task", "task_subtasks", "complete_task", "reopen_task", "log_work", "add_idea", "set_idea", "add_material", "add_payment", "set_payment", "set_service", "checklist", "attach_playbook", "detach_playbook", "save_playbook", "set_folder"] },
  { key: "delete", label: "Видаляти", desc: "задачі, записи, послуги, клієнтів (клієнта — тільки з точною назвою)", tools: ["delete_task", "delete_record", "delete_client", "remove_service"] },
  { key: "memory", label: "Памʼять", desc: "сам запамʼятовує і переписує, що знає про тебе і роботу", tools: ["memory_add", "memory_rewrite"] },
  { key: "files", label: "Робити файли (PDF)", desc: "звіти, інструкції, оновлення — PDF на А4", tools: ["make_pdf"] },
  { key: "telegram_send", label: "Писати тобі в Telegram", desc: "надіслати повідомлення або файл з будь-якої розмови", tools: ["telegram_send"] },
  { key: "groups", label: "Писати в групи клієнтів", desc: "повідомлення і файли (звіти, PDF) у Telegram-групу клієнта — тільки коли ти прямо попросив", tools: ["telegram_group_send"] },
  { key: "mail", label: "Пошта (читання)", desc: "шукати і читати листи в Gmail; надсилати листи Джері не може", tools: ["mail_search", "mail_read"] },
  { key: "drive", label: "Google Диск", desc: "створювати папки клієнтів", tools: ["drive_create_folders"] },
  { key: "calendar", label: "Google Календар", desc: "ставити задачі в календар", tools: ["task_to_calendar"] },
  { key: "links", label: "Привʼязувати кабінети і групи", desc: "рекламний кабінет Meta і Telegram-групу до клієнта", tools: ["meta_link", "telegram_link"] },
  { key: "journal", label: "Журнал системи", desc: "записувати запити на доробку і глюки", tools: ["journal_add"] },
  { key: "kb", label: "База знань (запис)", desc: "зберігати інструкції", tools: ["kb_save"] },
  { key: "lab", label: "Лабораторія", desc: "вести сесії вибору інструментів", tools: ["lab_create", "lab_update", "lab_add_option", "lab_update_option", "lab_add_criterion", "lab_set_scores", "lab_finish"] },
] as const;

export const AUTO = [
  { key: "digest", label: "Ранкове зведення в Telegram", desc: "що горить, сьогодні, гроші, проблеми реклами (без ШІ, безкоштовно)", setting: "tg.digest" },
  { key: "meta_analysis", label: "Тижневий розбір реклами від Джері", desc: "раз на тиждень на клієнта, дивиться креативи — коштує кредитів API", setting: "auto.meta_analysis" },
  { key: "backup", label: "Бекап бази на Google Диск", desc: "щоночі о 04:00, 30 копій", setting: "auto.backup" },
  { key: "tg_files", label: "Фото і файли з Telegram на Диск", desc: "копія в папку клієнта → «Telegram»", setting: "auto.tg_files" },
  { key: "live_dictation", label: "Живий текст під час диктування", desc: "бачиш, що Джері чує, поки говориш (ElevenLabs Realtime); вимкнеш — текст з'являється після «стоп»", setting: "voice.live" },
  { key: "reflect", label: "Самонавчання Джері", desc: "після кожної розмови оновлює памʼять — коштує трохи кредитів", setting: "auto.reflect" },
] as const;

export type CapKey = (typeof CAPS)[number]["key"];
export type AutoKey = (typeof AUTO)[number]["key"];

export const capOn = (k: CapKey) => getSetting(`cap.${k}`) !== "off";
export const autoOn = (k: AutoKey) => getSetting(AUTO.find((a) => a.key === k)!.setting) !== "off";

// Яку можливість вимикає інструмент (null — читання, завжди можна)
export function capOfTool(tool: string): (typeof CAPS)[number] | null {
  return CAPS.find((c) => (c.tools as readonly string[]).includes(tool)) ?? null;
}
export const toolAllowed = (tool: string) => { const c = capOfTool(tool); return !c || capOn(c.key); };

export function saveCaps(on: Set<string>): void {
  for (const c of CAPS) setSetting(`cap.${c.key}`, on.has(`cap.${c.key}`) ? "on" : "off");
  for (const a of AUTO) setSetting(a.setting, on.has(`auto.${a.key}`) ? "on" : "off");
}
