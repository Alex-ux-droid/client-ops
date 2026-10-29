export const STATUS_LABEL: Record<string, string> = {
  lead: "Лід",
  active: "Активний",
  paused: "Пауза",
  archived: "Архів",
};

export const STATUS_TAG: Record<string, string> = {
  lead: "warn",
  active: "ok",
  paused: "",
  archived: "",
};

export const STAGE_LABEL: Record<string, string> = {
  new: "Новий",
  contacted: "Контакт",
  proposal: "КП відправлено",
  negotiation: "Переговори",
};

export const KIND_LABEL: Record<string, string> = {
  chat: "Чат",
  ads: "Реклама",
  brief: "Бриф",
  other: "Інше",
};

export const MONTHS = ["січ", "лют", "бер", "кві", "тра", "чер", "лип", "сер", "вер", "жов", "лис", "гру"];
export const monthLabel = (ym: string) => MONTHS[Number(ym.slice(5, 7)) - 1];
