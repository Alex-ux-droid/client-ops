// Інструменти помічника: читання і запис у базу через lib/repo. Видаляти нічого не вміє — навмисно.
import type Anthropic from "@anthropic-ai/sdk";
import { ymd } from "../dates";
import { addAgentMemory, setAgentMemory } from "./config";
import { addAdStat, cpl, deleteAdStat, listAdStats } from "../repo/ads";
import type { ChatAction } from "../repo/chat";
import {
  CLIENT_FIELDS, CLIENT_STATUSES, clientFlags, createClient, deleteClient, getClientRow, LEAD_STAGES, listClients, updateClient,
  type ClientInput,
} from "../repo/clients";
import { addIdea, deleteIdea, listIdeas, setIdeaStatus } from "../repo/ideas";
import { addMaterial, deleteMaterial, getMaterial, listMaterials, MATERIAL_KINDS, type MaterialKind } from "../repo/materials";
import { addPayment, deletePayment, listPayments, markPaid, moneySummary } from "../repo/payments";
import { attachPlaybook, checklistItems, clientPlaybooks, detachPlaybook, getPlaybook, listPlaybooks, savePlaybook, setChecklistItem } from "../repo/playbooks";
import { searchAll } from "../repo/search";
import { createTask, deleteTask, getTask, listTasks, setTaskStatus, updateTask, type TaskView } from "../repo/tasks";
import { addWork, deleteWork, listWork } from "../repo/worklog";
import { createClientFolders, googleConnected, listMail, mailQuery, readMail } from "../google";
import { FOLDER_KINDS, isServiceType as isSvc } from "../services";
import { addDevEntry } from "../repo/devlog";
import { addTool, enableService, findToolByName, listServices, listTools, removeService, saveFolder, updateService } from "../repo/services";
import { isServiceType, SERVICE_TYPES, SERVICES, type ServiceDef } from "../services";

type Input = Record<string, unknown>;
type Ctx = { actions: ChatAction[] };

const s = (v: unknown) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v));
const n = (v: unknown) => {
  const x = typeof v === "number" ? v : Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(x) ? x : 0;
};
const id = (v: unknown) => {
  const x = Math.trunc(n(v));
  return x > 0 ? x : null;
};
const date = (v: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(s(v)) ? s(v) : null);
const need = <T,>(v: T | null | undefined, msg: string): T => {
  if (v === null || v === undefined || v === "") throw new Error(msg);
  return v;
};

const str = (description: string) => ({ type: "string", description });
const num = (description: string) => ({ type: "number", description });
const int = (description: string) => ({ type: "integer", description });
const obj = (properties: Record<string, unknown>, required: string[] = []) => ({ type: "object" as const, properties, required, additionalProperties: false });

const CLIENT_PROPS = {
  name: str("Назва клієнта"),
  niche: str("Ніша"),
  status: { type: "string", enum: [...CLIENT_STATUSES], description: "lead — потенційний, active — працюємо, paused, archived" },
  stage: { type: "string", enum: [...LEAD_STAGES], description: "Етап воронки для ліда: new, contacted, proposal (КП), negotiation" },
  fee_monthly: num("Скільки клієнт платить Саші щомісяця"),
  pay_day: int("День місяця оплати 1-31"),
  next_step: str("Наступний крок"),
  offer: str("Що продаємо клієнту"),
  budget: str("Рекламний бюджет / умови, текстом"),
  contacts: str("Контакти"),
  needs: str("Що хоче клієнт"),
  client_vision: str("Бачення клієнта"),
  my_vision: str("Бачення Саші"),
  notes: str("Нотатки"),
  bitwarden_ref: str("ТІЛЬКИ назва запису в Bitwarden, ніколи не пароль"),
  owner_name: str("Власник / хто приймає рішення"),
  locations: int("Скільки бізнесів / точок у клієнта"),
  city: str("Місто"),
  phone: str("Телефон"),
  email: str("Пошта"),
  work_since: str("З якої дати ведемо клієнта, YYYY-MM-DD"),
  drive_url: str("Посилання на папку клієнта в Google Диску"),
};

const SERVICE_DOC = SERVICE_TYPES.map((t) => {
  const d = SERVICES[t] as ServiceDef;
  return `${t} (${d.label}${d.tool ? `; інструмент: ${d.tool.label}` : ""}; поля: ${d.fields.map((f) => f.key).join(", ")})`;
}).join("; ");

export const TOOLS: Anthropic.Beta.BetaTool[] = [
  { name: "search", description: "Пошук по всій базі: клієнти, задачі, історія робіт, матеріали, ідеї, плейбуки.", input_schema: obj({ query: str("Що шукати, від 2 символів") }, ["query"]) },
  { name: "list_clients", description: "Список клієнтів і лідів з короткими цифрами і сигналами проблем.", input_schema: obj({}) },
  { name: "get_client", description: "Повна картка клієнта: поля, відкриті задачі, історія робіт, матеріали (назви), реклама, оплати, плейбуки.", input_schema: obj({ client_id: int("ID клієнта") }, ["client_id"]) },
  { name: "create_client", description: "Створити клієнта або ліда.", input_schema: obj(CLIENT_PROPS, ["name"]) },
  { name: "update_client", description: "Змінити поля клієнта. Передавай тільки те, що змінюється. Текстові поля замінюються повністю — якщо доповнюєш, передай старий текст + нове.", input_schema: obj({ client_id: int("ID клієнта"), ...CLIENT_PROPS }, ["client_id"]) },
  { name: "list_tasks", description: "Задачі. view: overdue, today, week (наступні дні тижня), later, all (всі відкриті), done (останні закриті).", input_schema: obj({ view: { type: "string", enum: ["overdue", "today", "week", "later", "all", "done"] }, client_id: int("Фільтр по клієнту, необов'язково") }, ["view"]) },
  { name: "create_task", description: "Створити задачу.", input_schema: obj({ title: str("Що зробити"), client_id: int("ID клієнта, якщо стосується клієнта"), due_date: str("Дедлайн YYYY-MM-DD"), details: str("Деталі") }, ["title"]) },
  { name: "update_task", description: "Змінити задачу: назву, деталі, дедлайн, статус todo/doing.", input_schema: obj({ task_id: int("ID задачі"), title: str("Назва"), details: str("Деталі"), due_date: str("YYYY-MM-DD"), status: { type: "string", enum: ["todo", "doing"] } }, ["task_id"]) },
  { name: "complete_task", description: "Закрити задачу і записати в історію клієнта, що зробили, навіщо і результат.", input_schema: obj({ task_id: int("ID задачі"), what: str("Що зробили"), why: str("Навіщо"), result: str("Результат") }, ["task_id"]) },
  { name: "log_work", description: "Записати в історію клієнта виконану роботу (без задачі).", input_schema: obj({ client_id: int("ID клієнта"), what: str("Що зробили"), why: str("Навіщо"), result: str("Результат"), done_at: str("Дата YYYY-MM-DD, за замовчуванням сьогодні") }, ["client_id", "what"]) },
  { name: "add_idea", description: "Записати ідею (загальну або для клієнта).", input_schema: obj({ text: str("Ідея"), client_id: int("ID клієнта, необов'язково") }, ["text"]) },
  { name: "add_material", description: "Зберегти матеріал клієнта: переписку, звіт, бриф.", input_schema: obj({ client_id: int("ID клієнта"), kind: { type: "string", enum: [...MATERIAL_KINDS] }, title: str("Назва"), content: str("Повний текст") }, ["client_id", "content"]) },
  { name: "get_material", description: "Прочитати повний текст матеріалу.", input_schema: obj({ material_id: int("ID матеріалу") }, ["material_id"]) },
  { name: "add_ad_stats", description: "Додати цифри з рекламного кабінету за період.", input_schema: obj({ client_id: int("ID клієнта"), period_start: str("YYYY-MM-DD"), period_end: str("YYYY-MM-DD"), spend: num("Витрачено"), impressions: int("Покази"), clicks: int("Кліки"), leads: int("Ліди"), sales: int("Продажі"), revenue: num("Виручка клієнта"), platform: str("facebook, google, tiktok, other"), note: str("Коментар") }, ["client_id", "period_start", "period_end"]) },
  { name: "add_payment", description: "Додати оплату від клієнта: отриману (paid=true) або очікувану.", input_schema: obj({ client_id: int("ID клієнта"), amount: num("Сума"), date: str("YYYY-MM-DD: дата оплати або очікувана дата"), paid: { type: "boolean" }, note: str("Коментар") }, ["client_id", "amount", "paid"]) },
  { name: "money_summary", description: "Гроші за поточний місяць: отримано, очікується, прострочено, щомісячний дохід, і список неоплачених.", input_schema: obj({}) },
  { name: "set_service", description: `Увімкнути послугу клієнту (відкриває вкладку в картці) і/або заповнити її. Типи: ${SERVICE_DOC}. Поля в details передавай тільки ті, що відомі.`, input_schema: obj({ client_id: int("ID клієнта"), type: { type: "string", enum: [...SERVICE_TYPES] }, status: { type: "string", enum: ["active", "paused", "done"] }, started_at: str("З якої дати, YYYY-MM-DD"), tool: str("Назва інструменту: яка CRM / телефонія / на чому сайт"), details: { type: "object", description: "Поля послуги: ключ → текст", additionalProperties: { type: "string" } }, notes: str("Нотатки") }, ["client_id", "type"]) },
  { name: "mail_search", description: "Gmail Саші: листування з клієнтом (за поштою з картки) або пошук за запитом Gmail (напр. 'subject:рахунок newer_than:30d'). Повертає теми, дати, уривки.", input_schema: obj({ client_id: int("ID клієнта — шукати листування з його адресами"), query: str("Довільний запит Gmail, якщо без клієнта") }) },
  { name: "mail_read", description: "Прочитати повний текст листа з Gmail за id (з mail_search).", input_schema: obj({ message_id: str("ID листа") }, ["message_id"]) },
  { name: "drive_create_folders", description: "Створити на Google Диску папку клієнта з підпапками (креативи, дані, портфоліо, документи, сайт) і прив'язати до картки.", input_schema: obj({ client_id: int("ID клієнта") }, ["client_id"]) },
  { name: "journal_add", description: "Записати в «Журнал системи» для розробника (Claude Code): чого система не вміє, а треба (request), глюк (bug) чи незручність/нюанс (note). Пиши як готове ТЗ: що потрібно, навіщо, на якому прикладі видно, як перевірити.", input_schema: obj({ kind: { type: "string", enum: ["request", "bug", "note"] }, title: str("Коротко, до 100 символів"), body: str("ТЗ: що, навіщо, приклад, як перевірити"), context: str("Де виникло: сторінка / клієнт") }, ["kind", "title", "body"]) },
  { name: "delete_task", description: "Видалити задачу назавжди (якщо треба просто прибрати з планів).", input_schema: obj({ task_id: int("ID задачі") }, ["task_id"]) },
  { name: "reopen_task", description: "Повернути закриту задачу в роботу.", input_schema: obj({ task_id: int("ID задачі") }, ["task_id"]) },
  { name: "remove_service", description: "Прибрати послугу з картки клієнта (вкладка зникне, її поля видаляться). Якщо просто закінчили роботу — краще set_service зі status done.", input_schema: obj({ client_id: int("ID клієнта"), type: { type: "string", enum: [...SERVICE_TYPES] } }, ["client_id", "type"]) },
  { name: "set_payment", description: "Відмітити оплату як отриману / не отриману, або видалити оплату.", input_schema: obj({ payment_id: int("ID оплати (з get_client або money_summary)"), action: { type: "string", enum: ["paid", "unpaid", "delete"] } }, ["payment_id", "action"]) },
  { name: "list_ideas", description: "Ідеї (з id): нові, використані, відкинуті.", input_schema: obj({ client_id: int("Фільтр по клієнту"), status: { type: "string", enum: ["new", "used", "dropped"] } }) },
  { name: "set_idea", description: "Позначити ідею використаною/відкинутою/новою або видалити.", input_schema: obj({ idea_id: int("ID ідеї"), action: { type: "string", enum: ["new", "used", "dropped", "delete"] } }, ["idea_id", "action"]) },
  { name: "delete_record", description: "Видалити запис: work (історія робіт), material (матеріал), ad_stat (період реклами).", input_schema: obj({ kind: { type: "string", enum: ["work", "material", "ad_stat"] }, id: int("ID запису") }, ["kind", "id"]) },
  { name: "checklist", description: "Поставити або зняти галочку в плейбуці клієнта (client_playbook_id та index — з get_client).", input_schema: obj({ client_playbook_id: int("ID плейбука клієнта"), index: int("Номер пункту з 0"), done: { type: "boolean" } }, ["client_playbook_id", "index", "done"]) },
  { name: "detach_playbook", description: "Відключити плейбук від клієнта.", input_schema: obj({ client_playbook_id: int("ID плейбука клієнта") }, ["client_playbook_id"]) },
  { name: "save_playbook", description: "Створити новий плейбук або оновити існуючий (передай playbook_id). body_md: заголовки '#' і пункти '- [ ] текст'.", input_schema: obj({ playbook_id: int("ID, якщо оновлюємо"), title: str("Назва"), body_md: str("Markdown з чеклістом"), tags: str("Теги через кому") }, ["title", "body_md"]) },
  { name: "set_folder", description: "Прив'язати посилання на папку клієнта: main (головна) або creatives, data, portfolio, docs, website.", input_schema: obj({ client_id: int("ID клієнта"), kind: { type: "string", enum: ["main", ...FOLDER_KINDS.map((f) => f.kind)] }, url: str("Посилання") }, ["client_id", "kind", "url"]) },
  { name: "delete_client", description: "ВИДАЛИТИ клієнта назавжди з усією історією, оплатами, матеріалами. Тільки коли Саша прямо сказав «видали клієнта». В інших випадках — update_client зі status archived (архів, можна повернути).", input_schema: obj({ client_id: int("ID клієнта"), confirm_name: str("Точна назва клієнта для підтвердження") }, ["client_id", "confirm_name"]) },
  { name: "memory_add", description: "Запам'ятати надовго: факт про Сашу, його підхід, ціни, правила, вподобання, важливі рішення по роботі. Коротко, одним реченням. Не дублюй те, що вже є в пам'яті.", input_schema: obj({ note: str("Що запам'ятати") }, ["note"]) },
  { name: "memory_rewrite", description: "Переписати пам'ять повністю — коли вона розрослась (понад ~6000 символів) або застаріла: стисни, прибери дублі й неактуальне, нічого важливого не губи.", input_schema: obj({ text: str("Нова пам'ять повністю, пунктами") }, ["text"]) },
  { name: "list_playbooks", description: "Список плейбуків.", input_schema: obj({}) },
  { name: "get_playbook", description: "Текст плейбука.", input_schema: obj({ playbook_id: int("ID плейбука") }, ["playbook_id"]) },
  { name: "attach_playbook", description: "Підключити плейбук до клієнта.", input_schema: obj({ client_id: int("ID клієнта"), playbook_id: int("ID плейбука") }, ["client_id", "playbook_id"]) },
];

const clientName = (cid: number | null) => (cid ? getClientRow(cid)?.name ?? `#${cid}` : null);

export async function runTool(name: string, input: Input, ctx: Ctx): Promise<unknown> {
  const act = (kind: string, text: string, href?: string) => ctx.actions.push({ kind, text, href });
  switch (name) {
    case "search":
      return searchAll(s(input.query), 8);

    case "list_clients":
      return listClients().map((c) => ({
        id: c.id, name: c.name, status: c.status, stage: c.status === "lead" ? c.stage : undefined, niche: c.niche, offer: c.offer,
        fee_monthly: c.fee_monthly, next_step: c.next_step, open_tasks: c.open_tasks, last_work: c.last_work, debt: c.debt,
        flags: clientFlags(c).map((f) => f.text),
      }));

    case "get_client": {
      const cid = need(id(input.client_id), "client_id обов'язковий");
      const c = need(getClientRow(cid), `Клієнта ${cid} нема`);
      const ads = listAdStats(cid).slice(-6);
      return {
        ...c,
        flags: clientFlags(c).map((f) => f.text),
        open_tasks: listTasks("all", cid).map((t) => ({ id: t.id, title: t.title, due_date: t.due_date, status: t.status })),
        recent_work: listWork(cid, 15).map((w) => ({ id: w.id, date: w.done_at, what: w.what, why: w.why, result: w.result })),
        materials: listMaterials(cid).map((m) => ({ id: m.id, kind: m.kind, title: m.title, created_at: m.created_at })),
        ads: ads.map((a) => ({ ...a, cpl: cpl(a) })),
        payments: listPayments({ clientId: cid }).slice(0, 12).map((p) => ({ id: p.id, amount: p.amount, due_date: p.due_date, paid_at: p.paid_at, note: p.note })),
        services: listServices(cid).map((sv) => ({ type: sv.type, status: sv.status, started_at: sv.started_at, tool: sv.tool_name, details: sv.details, notes: sv.notes })),
        playbooks: clientPlaybooks(cid).map((p) => ({ client_playbook_id: p.id, title: p.title, items: checklistItems(p.body_md).map((t, i) => ({ index: i, text: t, done: p.checked.includes(i) })) })),
        ideas: listIdeas({ clientId: cid }).map((i) => ({ id: i.id, text: i.text, status: i.status })),
      };
    }

    case "create_client":
    case "update_client": {
      const fields: Partial<ClientInput> = {};
      for (const f of CLIENT_FIELDS) {
        if (input[f] === undefined) continue;
        if (f === "fee_monthly") fields.fee_monthly = n(input[f]);
        else if (f === "locations") fields.locations = Math.max(Math.trunc(n(input[f])) || 1, 1);
        else if (f === "work_since") fields.work_since = date(input[f]);
        else if (f === "pay_day") fields.pay_day = Math.min(Math.max(Math.trunc(n(input[f])) || 1, 1), 31);
        else if (f === "status") { if (CLIENT_STATUSES.includes(s(input[f]) as never)) fields.status = s(input[f]) as ClientInput["status"]; }
        else if (f === "stage") { if (LEAD_STAGES.includes(s(input[f]) as never)) fields.stage = s(input[f]) as ClientInput["stage"]; }
        else (fields as Record<string, string>)[f] = s(input[f]);
      }
      if (name === "create_client") {
        need(fields.name, "name обов'язковий");
        const base = Object.fromEntries(CLIENT_FIELDS.map((f) => [f, ""])) as unknown as ClientInput;
        const cid = createClient({ ...base, status: "lead", stage: "new", fee_monthly: 0, pay_day: 1, locations: 1, work_since: null, ...fields } as ClientInput);
        act("client", `Створено: ${fields.name}`, `/clients/${cid}`);
        return { ok: true, client_id: cid };
      }
      const cid = need(id(input.client_id), "client_id обов'язковий");
      need(getClientRow(cid), `Клієнта ${cid} нема`);
      updateClient(cid, fields);
      act("client", `Оновлено ${clientName(cid)}: ${Object.keys(fields).join(", ")}`, `/clients/${cid}`);
      return { ok: true };
    }

    case "list_tasks": {
      const view = (["overdue", "today", "week", "later", "all", "done"].includes(s(input.view)) ? s(input.view) : "all") as TaskView;
      return listTasks(view, id(input.client_id) ?? undefined).map((t) => ({ id: t.id, title: t.title, client: t.client_name, client_id: t.client_id, due_date: t.due_date, status: t.status, details: t.details }));
    }

    case "create_task": {
      const title = need(s(input.title), "title обов'язковий");
      const cid = id(input.client_id);
      const due = date(input.due_date);
      const tid = createTask({ title, client_id: cid, due_date: due, details: s(input.details) });
      act("task", `Задача: ${title}${due ? ` · ${due}` : ""}${cid ? ` · ${clientName(cid)}` : ""}`, cid ? `/clients/${cid}?tab=tasks` : "/tasks?view=all");
      return { ok: true, task_id: tid };
    }

    case "update_task": {
      const tid = need(id(input.task_id), "task_id обов'язковий");
      const t = need(getTask(tid), `Задачі ${tid} нема`);
      const patch: Parameters<typeof updateTask>[1] = {};
      if (input.title !== undefined) patch.title = s(input.title);
      if (input.details !== undefined) patch.details = s(input.details);
      if (input.due_date !== undefined) patch.due_date = date(input.due_date);
      updateTask(tid, patch);
      if (input.status === "todo" || input.status === "doing") setTaskStatus(tid, input.status);
      act("task", `Змінено задачу: ${patch.title ?? t.title}`, t.client_id ? `/clients/${t.client_id}?tab=tasks` : "/tasks?view=all");
      return { ok: true };
    }

    case "complete_task": {
      const tid = need(id(input.task_id), "task_id обов'язковий");
      const t = need(getTask(tid), `Задачі ${tid} нема`);
      setTaskStatus(tid, "done");
      if (t.client_id) addWork({ client_id: t.client_id, task_id: tid, done_at: ymd(), what: s(input.what) || t.title, why: s(input.why), result: s(input.result) });
      act("done", `Закрито: ${t.title}${t.client_id ? " (+ в історію)" : ""}`, t.client_id ? `/clients/${t.client_id}?tab=history` : "/tasks?view=done");
      return { ok: true, logged: !!t.client_id };
    }

    case "log_work": {
      const cid = need(id(input.client_id), "client_id обов'язковий");
      const what = need(s(input.what), "what обов'язковий");
      addWork({ client_id: cid, what, why: s(input.why), result: s(input.result), done_at: date(input.done_at) ?? ymd() });
      act("work", `В історію ${clientName(cid)}: ${what}`, `/clients/${cid}?tab=history`);
      return { ok: true };
    }

    case "add_idea": {
      const text = need(s(input.text), "text обов'язковий");
      const cid = id(input.client_id);
      addIdea(text, cid);
      act("idea", `Ідея: ${text.slice(0, 80)}`, "/ideas");
      return { ok: true };
    }

    case "add_material": {
      const cid = need(id(input.client_id), "client_id обов'язковий");
      const content = need(s(input.content), "content обов'язковий");
      const kind = (MATERIAL_KINDS.includes(s(input.kind) as MaterialKind) ? s(input.kind) : "other") as MaterialKind;
      const title = s(input.title) || content.slice(0, 60);
      addMaterial({ client_id: cid, kind, title, content });
      act("material", `Матеріал: ${title}`, `/clients/${cid}?tab=materials`);
      return { ok: true };
    }

    case "get_material":
      return need(getMaterial(need(id(input.material_id), "material_id обов'язковий")), "Матеріалу нема");

    case "add_ad_stats": {
      const cid = need(id(input.client_id), "client_id обов'язковий");
      const ps = need(date(input.period_start), "period_start YYYY-MM-DD");
      const pe = need(date(input.period_end), "period_end YYYY-MM-DD");
      addAdStat({
        client_id: cid, platform: s(input.platform) || "facebook", period_start: ps, period_end: pe,
        spend: n(input.spend), impressions: Math.trunc(n(input.impressions)), clicks: Math.trunc(n(input.clicks)),
        leads: Math.trunc(n(input.leads)), sales: Math.trunc(n(input.sales)), revenue: n(input.revenue), note: s(input.note),
      });
      const svc = SERVICE_TYPES.find((t) => (SERVICES[t] as ServiceDef).adPlatform === (s(input.platform) || "facebook"));
      act("ads", `Реклама ${clientName(cid)}: ${ps}–${pe}`, `/clients/${cid}?tab=${svc ?? "overview"}`);
      return { ok: true };
    }

    case "add_payment": {
      const cid = need(id(input.client_id), "client_id обов'язковий");
      const amount = n(input.amount);
      if (amount <= 0) throw new Error("amount має бути > 0");
      const d = date(input.date) ?? ymd();
      addPayment({ client_id: cid, amount, due_date: d, paid_at: input.paid === true ? d : null, note: s(input.note) });
      act("money", `${input.paid === true ? "Оплата отримана" : "Очікується оплата"}: ${amount} · ${clientName(cid)}`, `/clients/${cid}?tab=money`);
      return { ok: true };
    }

    case "money_summary":
      return { ...moneySummary(ymd().slice(0, 7)), unpaid: listPayments({ open: true }).map((p) => ({ client: p.client_name, amount: p.amount, due_date: p.due_date })) };

    case "set_service": {
      const cid = need(id(input.client_id), "client_id обов'язковий");
      const type = s(input.type);
      if (!isServiceType(type)) throw new Error(`Невідомий тип послуги ${type}`);
      need(getClientRow(cid), `Клієнта ${cid} нема`);
      const def = SERVICES[type] as ServiceDef;
      enableService(cid, type, date(input.started_at) ?? ymd());
      let toolId: number | null | undefined;
      if (def.tool && s(input.tool)) toolId = findToolByName(def.tool.category, s(input.tool))?.id ?? addTool(def.tool.category, s(input.tool));
      const raw = (input.details && typeof input.details === "object" ? input.details : {}) as Record<string, unknown>;
      const allowed = new Set(def.fields.map((f) => f.key));
      const details = Object.fromEntries(Object.entries(raw).filter(([k]) => allowed.has(k)).map(([k, v]) => [k, s(v)]));
      const st = s(input.status);
      updateService(cid, type, {
        ...(st === "active" || st === "paused" || st === "done" ? { status: st } : {}),
        ...(date(input.started_at) ? { started_at: date(input.started_at) } : {}),
        ...(toolId !== undefined ? { tool_id: toolId } : {}),
        details,
        ...(input.notes !== undefined ? { notes: s(input.notes) } : {}),
      });
      act("service", `${def.label} · ${clientName(cid)}`, `/clients/${cid}?tab=${type}`);
      return { ok: true, known_tools: def.tool ? listTools(def.tool.category).map((t) => t.name) : undefined };
    }

    case "mail_search": {
      if (!googleConnected()) throw new Error("Google не підключено (Налаштування → Google)");
      const cid = id(input.client_id);
      const q = cid ? mailQuery(need(getClientRow(cid), "Клієнта нема").email) : s(input.query);
      if (!q) throw new Error(cid ? "У картці клієнта нема пошти" : "Потрібен query або client_id");
      return (await listMail(q, 15)).map((m) => ({ id: m.id, from: m.from, to: m.to, subject: m.subject, date: m.date.slice(0, 10), snippet: m.snippet, incoming: m.incoming }));
    }

    case "mail_read": {
      if (!googleConnected()) throw new Error("Google не підключено");
      const m = await readMail(need(s(input.message_id), "message_id обов'язковий"));
      return { from: m.from, to: m.to, subject: m.subject, date: m.date, body: m.body.slice(0, 20_000) };
    }

    case "drive_create_folders": {
      if (!googleConnected()) throw new Error("Google не підключено");
      const cid = need(id(input.client_id), "client_id обов'язковий");
      const c = need(getClientRow(cid), "Клієнта нема");
      if (c.drive_url) return { ok: true, already: c.drive_url };
      const { mainUrl, subs } = await createClientFolders(c.name, FOLDER_KINDS);
      updateClient(cid, { drive_url: mainUrl });
      for (const f of subs) saveFolder(cid, f.kind, f.title, f.url);
      act("files", `Папки на Диску: ${c.name}`, `/clients/${cid}?tab=files`);
      return { ok: true, url: mainUrl };
    }

    case "journal_add": {
      const kind = s(input.kind);
      if (!["request", "bug", "note"].includes(kind)) throw new Error("kind: request | bug | note");
      addDevEntry({ kind: kind as "request" | "bug" | "note", source: "assistant", title: need(s(input.title), "title обов'язковий"), body: s(input.body), context: s(input.context) });
      act("journal", `У журнал: ${s(input.title).slice(0, 60)}`, "/journal");
      return { ok: true };
    }

    case "delete_task": {
      const t = need(getTask(need(id(input.task_id), "task_id")), "Задачі нема");
      deleteTask(t.id);
      act("delete", `Видалено задачу: ${t.title}`);
      return { ok: true };
    }

    case "reopen_task": {
      const t = need(getTask(need(id(input.task_id), "task_id")), "Задачі нема");
      setTaskStatus(t.id, "todo");
      act("task", `Знову в роботі: ${t.title}`, t.client_id ? `/clients/${t.client_id}?tab=tasks` : "/tasks?view=all");
      return { ok: true };
    }

    case "remove_service": {
      const cid = need(id(input.client_id), "client_id");
      const type = s(input.type);
      if (!isSvc(type)) throw new Error("Невідомий тип послуги");
      removeService(cid, type);
      act("delete", `Прибрано послугу ${SERVICES[type].label} · ${clientName(cid)}`, `/clients/${cid}`);
      return { ok: true };
    }

    case "set_payment": {
      const pid = need(id(input.payment_id), "payment_id");
      const a = s(input.action);
      if (a === "delete") deletePayment(pid); else markPaid(pid, a === "paid");
      act("money", a === "delete" ? "Оплату видалено" : a === "paid" ? "Оплату отримано" : "Оплату позначено неотриманою", "/money");
      return { ok: true };
    }

    case "list_ideas":
      return listIdeas({ clientId: id(input.client_id) ?? undefined, status: (["new", "used", "dropped"].includes(s(input.status)) ? s(input.status) : undefined) as never })
        .map((i) => ({ id: i.id, text: i.text, status: i.status, client: i.client_name }));

    case "set_idea": {
      const iid = need(id(input.idea_id), "idea_id");
      const a = s(input.action);
      if (a === "delete") deleteIdea(iid);
      else if (a === "new" || a === "used" || a === "dropped") setIdeaStatus(iid, a);
      else throw new Error("action: new | used | dropped | delete");
      act("idea", a === "delete" ? "Ідею видалено" : `Ідея → ${a === "used" ? "використана" : a === "dropped" ? "відкинута" : "нова"}`, "/ideas");
      return { ok: true };
    }

    case "delete_record": {
      const rid = need(id(input.id), "id");
      const k = s(input.kind);
      if (k === "work") deleteWork(rid); else if (k === "material") deleteMaterial(rid); else if (k === "ad_stat") deleteAdStat(rid);
      else throw new Error("kind: work | material | ad_stat");
      act("delete", `Видалено запис (${k === "work" ? "історія" : k === "material" ? "матеріал" : "реклама"})`);
      return { ok: true };
    }

    case "checklist": {
      setChecklistItem(need(id(input.client_playbook_id), "client_playbook_id"), Math.trunc(n(input.index)), input.done === true);
      act("playbook", input.done === true ? "Пункт плейбука виконано" : "Галочку знято");
      return { ok: true };
    }

    case "detach_playbook": {
      detachPlaybook(need(id(input.client_playbook_id), "client_playbook_id"));
      act("playbook", "Плейбук відключено");
      return { ok: true };
    }

    case "save_playbook": {
      const pid = savePlaybook({ id: id(input.playbook_id), title: need(s(input.title), "title"), body_md: s(input.body_md), tags: s(input.tags) });
      act("playbook", `Плейбук: ${s(input.title)}`, `/playbooks/${pid}`);
      return { ok: true, playbook_id: pid };
    }

    case "set_folder": {
      const cid = need(id(input.client_id), "client_id");
      const kind = s(input.kind);
      const url = need(s(input.url), "url");
      if (kind === "main") updateClient(cid, { drive_url: url });
      else {
        const f = FOLDER_KINDS.find((x) => x.kind === kind);
        if (!f) throw new Error("Невідомий тип папки");
        saveFolder(cid, f.kind, f.title, url);
      }
      act("files", `Папка: ${kind}`, `/clients/${cid}?tab=files`);
      return { ok: true };
    }

    case "delete_client": {
      const cid = need(id(input.client_id), "client_id");
      const c = need(getClientRow(cid), "Клієнта нема");
      if (s(input.confirm_name).toLowerCase() !== c.name.toLowerCase()) throw new Error(`Для підтвердження потрібна точна назва: «${c.name}»`);
      deleteClient(cid);
      act("delete", `Клієнта видалено: ${c.name}`, "/clients");
      return { ok: true };
    }

    case "memory_add": {
      const len = addAgentMemory(need(s(input.note), "note"));
      act("memory", `Запам'ятав: ${s(input.note).slice(0, 70)}`, "/settings?tab=agent");
      return { ok: true, memory_chars: len, hint: len > 6000 ? "Пам'ять велика — стисни через memory_rewrite" : undefined };
    }

    case "memory_rewrite": {
      setAgentMemory(need(s(input.text), "text"));
      act("memory", "Пам'ять оновлено", "/settings?tab=agent");
      return { ok: true };
    }

    case "list_playbooks":
      return listPlaybooks().map((p) => ({ id: p.id, title: p.title, items: p.items, tags: p.tags }));

    case "get_playbook":
      return need(getPlaybook(need(id(input.playbook_id), "playbook_id обов'язковий")), "Плейбука нема");

    case "attach_playbook": {
      const cid = need(id(input.client_id), "client_id обов'язковий");
      const pid = need(id(input.playbook_id), "playbook_id обов'язковий");
      const pb = need(getPlaybook(pid), "Плейбука нема");
      attachPlaybook(cid, pid);
      act("playbook", `Плейбук «${pb.title}» → ${clientName(cid)}`, `/clients/${cid}?tab=playbooks`);
      return { ok: true };
    }
  }
  throw new Error(`Невідомий інструмент ${name}`);
}

